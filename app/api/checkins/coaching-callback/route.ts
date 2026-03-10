import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNormalizedReply(value: unknown): string {
  const extractReply = (input: unknown, depth = 0): string => {
    if (depth > 4 || input === null || input === undefined) return "";

    if (typeof input === "string") {
      const text = input.trim();
      if (!text) return "";

      try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed && typeof parsed === "object") {
          const nested = extractReply(parsed, depth + 1);
          if (nested) return nested;
        }
      } catch {}

      return text;
    }

    if (typeof input === "object") {
      const record = input as Record<string, unknown>;
      const directReply = record.reply;
      if (typeof directReply === "string") return directReply.trim();

      for (const nestedValue of Object.values(record)) {
        const nested = extractReply(nestedValue, depth + 1);
        if (nested) return nested;
      }
    }

    return "";
  };

  return extractReply(value).trim();
}

async function generateAndUpdateCoachingTitle(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sessionId: string,
  reply: string
): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return;

  try {
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("id, title")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session?.title) return;

    // Only run once — skip if title already has 2 or more "—" separators
    const dashCount = (session.title.match(/—/g) ?? []).length;
    if (dashCount >= 2) return;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 20,
        messages: [
          {
            role: "system",
            content: "You generate short coaching session context labels. Given a coach's reply to an employee check-in, generate a 3-5 word label that captures the key theme or insight. Written in Title Case. No punctuation at the end. Respond with only the label. Nothing else.",
          },
          {
            role: "user",
            content: `Coach reply: ${reply.slice(0, 500)}`,
          },
        ],
      }),
    });

    if (!response.ok) return;

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const context = data.choices?.[0]?.message?.content?.trim();
    if (!context || context.length === 0) return;

    const updatedTitle = `${session.title} — ${context}`;
    await supabase
      .from("chat_sessions")
      .update({ title: updatedTitle })
      .eq("id", sessionId);

    console.log("[coaching-callback] Session title updated", { sessionId, updatedTitle });
  } catch (err) {
    console.error("[coaching-callback] Title generation failed:", err instanceof Error ? err.message : String(err));
  }
}

export async function POST(req: Request) {
  // Server-to-server callback from n8n, protected by COACHING_CALLBACK_SECRET.
  // Uses service-role client to bypass RLS since this is a backend-only write with secret validation.
  const supabase = createSupabaseAdminClient();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const secret = getString(body?.secret);
  const sessionId = getString(body?.sessionId);
  const submissionId = getString(body?.submissionId);
  const userId = getString(body?.userId);
  const reply = getNormalizedReply(body?.reply);
  const source = getString(body?.source);

  const expectedSecret = process.env.COACHING_CALLBACK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Missing COACHING_CALLBACK_SECRET" },
      { status: 500 }
    );
  }

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!sessionId || !submissionId || !userId || !reply || !source) {
    return NextResponse.json(
      { error: "Missing required fields: sessionId, submissionId, userId, reply, source" },
      { status: 400 }
    );
  }

  // Idempotency: if we already processed this submission callback for this session, skip insert.
  const { data: existingCallbackEvent, error: existingEventError } = await supabase
    .from("chat_events")
    .select("id")
    .eq("user_id", userId)
    .eq("route", "checkins/coaching-callback")
    .eq("message", "coaching_reply_received")
    .contains("chat_events", {
      sessionId,
      submissionId,
    })
    .limit(1)
    .maybeSingle();

  if (!existingEventError && existingCallbackEvent) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Fallback duplicate guard when event row is unavailable: same assistant content in same session.
  const { data: existingAssistantMessage, error: existingAssistantError } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("role", "assistant")
    .eq("content", reply)
    .limit(1)
    .maybeSingle();

  if (!existingAssistantError && existingAssistantMessage) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const { error: messageError } = await supabase.from("chat_messages").insert({
    session_id: sessionId,
    user_id: userId,
    role: "assistant",
    // Normalize callback payloads before storage so chat content is always plain markdown text.
    content: reply,
  });

  if (messageError) {
    console.error("[checkins/coaching-callback] Failed to insert assistant reply:", {
      message: messageError.message,
      code: messageError.code,
      details: messageError.details,
    });

    return NextResponse.json(
      { error: "Failed to store assistant reply" },
      { status: 500 }
    );
  }

  void generateAndUpdateCoachingTitle(supabase, sessionId, reply);

  const requestId = crypto.randomUUID();
  const { error: eventError } = await supabase.from("chat_events").insert({
    user_id: userId,
    direction: "receive",
    message: "coaching_reply_received",
    request_id: requestId,
    route: "checkins/coaching-callback",
    chat_events: {
      event: "coaching_reply_received",
      source,
      sessionId,
      submissionId,
    },
  });

  if (eventError) {
    console.error("[checkins/coaching-callback] Optional chat_events insert failed:", {
      message: eventError.message,
      code: eventError.code,
      details: eventError.details,
    });
  }

  return NextResponse.json({ ok: true });
}
