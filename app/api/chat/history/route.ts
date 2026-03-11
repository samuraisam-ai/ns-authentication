import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sessionError) {
    console.error("[chat-history] Failed to verify session:", sessionError.message);
    return NextResponse.json({ error: "Failed to verify session" }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { data: messages, error: messagesError } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .neq("role", "system")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (messagesError) {
    console.error("[chat-history] Failed to fetch messages:", messagesError.message);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }

  return NextResponse.json({ sessionId, messages: messages ?? [] });
}
