import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type ChatEventDirection = "send" | "receive";

export function newRequestId() {
  return randomUUID();
}

export async function logChatEvent(params: {
  userId: string;
  direction: ChatEventDirection;
  message: string;
  requestId: string;
  route: string;
}) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("chat_events").insert({
    user_id: params.userId,
    direction: params.direction,
    message: params.message,
    request_id: params.requestId,
    route: params.route,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[chat-events]", params.route, params.direction, error);
  }
}
