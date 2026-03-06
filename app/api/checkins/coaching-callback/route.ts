import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
  const reply = getString(body?.reply);
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
