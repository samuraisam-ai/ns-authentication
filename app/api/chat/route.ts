import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

function getAllowlists() {
  const rawEmails = process.env.ALLOWED_EMAILS ?? "";
  const rawDomains = process.env.ALLOWED_DOMAINS ?? "";

  const emails = rawEmails
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const domains = rawDomains
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  return { emails, domains };
}

function isAllowlisted(email: string | null | undefined) {
  const { emails, domains } = getAllowlists();
  if (emails.length === 0 && domains.length === 0) return true;
  if (!email) return false;

  const normalizedEmail = email.toLowerCase();
  if (emails.includes(normalizedEmail)) return true;

  return domains.some((domain) => {
    const normalized = domain.startsWith("@") ? domain.slice(1) : domain;
    return normalizedEmail.endsWith(`@${normalized}`);
  });
}

function getWebhookConfig() {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl) throw new Error("Missing N8N_WEBHOOK_URL");
  if (!webhookSecret) throw new Error("Missing N8N_WEBHOOK_SECRET");

  return { webhookUrl, webhookSecret };
}

export async function POST(request: Request) {
  const reqId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const body = (await request.json().catch(() => ({}))) as { message?: string };
    const message = typeof body.message === "string" ? body.message : "";
    const messageLen = message.length;
    const preview = message.slice(0, 80);

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log(`[chat] reqId=${reqId} user=unknown messageLen=${messageLen} preview="${preview}"`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAllowlisted(user.email)) {
      console.log(`[chat] reqId=${reqId} user=${user.email ?? user.id} messageLen=${messageLen} preview="${preview}"`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    console.log(`[chat] reqId=${reqId} user=${user.email ?? user.id} messageLen=${messageLen} preview="${preview}"`);

    const { webhookUrl, webhookSecret } = getWebhookConfig();
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": webhookSecret,
      },
      body: JSON.stringify({ message, user: { id: user.id, email: user.email } }),
    });

    if (!webhookResponse.ok) {
      throw new Error(`n8n_error status=${webhookResponse.status}`);
    }

    const responsePayload = (await webhookResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const responseKeys = Object.keys(responsePayload);
    const durationMs = Date.now() - startedAt;

    console.log(
      `[chat] reqId=${reqId} ok durationMs=${durationMs} responseKeys=${responseKeys.join(",")}`
    );

    return NextResponse.json(responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[chat] reqId=${reqId} error=${message}`);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
