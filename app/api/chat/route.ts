import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type ChatRequestBody = {
  message?: string;
  sessionId?: string;
};

type N8nResponse = {
  reply?: string;
};

function normalizeMessage(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseN8nReply(rawText: string): string {
  if (!rawText) return "No response";

  try {
    const parsed = JSON.parse(rawText) as N8nResponse | unknown;
    if (parsed && typeof parsed === "object" && "reply" in parsed) {
      const reply = (parsed as N8nResponse).reply;
      if (typeof reply === "string" && reply.trim()) return reply.trim();
    }
  } catch {
    // Non-JSON response, fall back to text.
  }

  const text = rawText.trim();
  return text.length > 0 ? text : "No response";
}

function truncateTitle(message: string) {
  return message.length > 48 ? message.slice(0, 48) : message;
}

async function generateChatTitle(userMessage: string, assistantReply: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
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
            content: "You generate short chat session titles. Given a user message and assistant reply, generate a title that is 4-6 words maximum, captures the specific topic, is written in Title Case, has no punctuation at the end, and never starts with 'Chat About' or 'Discussion Of'. Respond with only the title. Nothing else.",
          },
          {
            role: "user",
            content: `User message: ${userMessage.slice(0, 300)}\n\nAssistant reply: ${assistantReply.slice(0, 300)}`,
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const title = data.choices?.[0]?.message?.content?.trim();
    return title && title.length > 0 ? title : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
  const message = normalizeMessage(body.message);

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "Missing N8N_WEBHOOK_URL" }, { status: 500 });
  }

  let sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

  if (!sessionId) {
    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title: "New chat" })
      .select("id")
      .single();

    if (error || !session) {
      console.error("[chat] Failed to create session:", error?.message ?? "unknown_error");
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    sessionId = session.id;
  }

  const { data: sessionCheck, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id, title")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sessionError) {
    console.error("[chat] Failed to verify session:", sessionError.message);
    return NextResponse.json({ error: "Failed to verify session" }, { status: 500 });
  }

  if (!sessionCheck) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { error: insertUserError } = await supabase.from("chat_messages").insert({
    session_id: sessionId,
    user_id: user.id,
    role: "user",
    content: message,
  });

  if (insertUserError) {
    console.error("[chat] Failed to store user message:", insertUserError.message);
    return NextResponse.json({ error: "Failed to store message" }, { status: 500 });
  }

  let reply = "No response";

  const request_id = crypto.randomUUID();
  const envelopePayload = {
    id: crypto.randomUUID(),
    user_id: user.id,
    direction: "send",
    message,
    request_id,
    route: "/api/chat",
    created_at: new Date().toISOString(),
    chat_events: { body: { message, sessionId } },
    identity: { id: user.id, email: user.email },
    sessionId,
  };

  console.log("[chat] n8n request", { request_id, sessionId });

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelopePayload),
    });

    const rawText = await webhookResponse.text();

    if (!webhookResponse.ok) {
      return NextResponse.json({ error: "n8n_failed", sessionId }, { status: 502 });
    }

    reply = parseN8nReply(rawText);
  } catch (error) {
    console.error("[chat] n8n request failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "n8n_failed", sessionId }, { status: 502 });
  }

  const { error: insertAssistantError } = await supabase.from("chat_messages").insert({
    session_id: sessionId,
    user_id: user.id,
    role: "assistant",
    content: reply,
  });

  if (insertAssistantError) {
    console.error("[chat] Failed to store assistant message:", insertAssistantError.message);
    return NextResponse.json({ error: "Failed to store reply" }, { status: 500 });
  }

  if (sessionCheck.title === "New chat") {
    void (async () => {
      const generatedTitle = await generateChatTitle(message, reply);
      const nextTitle = generatedTitle ?? truncateTitle(message);
      const { error: updateError } = await supabase
        .from("chat_sessions")
        .update({ title: nextTitle })
        .eq("id", sessionId)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("[chat] Failed to update title:", updateError.message);
      }
    })();
  }

  return NextResponse.json({ reply, sessionId });
}
