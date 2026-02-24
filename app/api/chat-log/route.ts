import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const message = getString(body?.message);
  const direction = "inbound";
  const route = "/workspace";
  const sessionId = getString(body?.sessionId, "");

  if (!user.id || !direction || !message) {
    return NextResponse.json(
      { error: "Missing required fields: user_id, direction, message" },
      { status: 400 }
    );
  }

  const request_id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  const payload = {
    id: crypto.randomUUID(),
    user_id: user.id,
    direction,
    message,
    request_id,
    route,
    created_at,
    chat_events: { body: body ?? null },
    identity: {
      id: user.id,
      email: getString(user.email),
    },
    ...(sessionId ? { sessionId } : {}),
  };

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "Missing N8N_WEBHOOK_URL" }, { status: 500 });
  }

  const n8nRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!n8nRes.ok) {
    const text = await n8nRes.text().catch(() => "");
    return NextResponse.json({ error: "n8n failed", detail: text }, { status: 502 });
  }

  return NextResponse.json({ ok: true, request_id });
}
