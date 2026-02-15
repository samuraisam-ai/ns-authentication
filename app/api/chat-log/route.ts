import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error("[chat-log] Missing N8N_WEBHOOK_URL");
    return NextResponse.json(
      { error: "Missing N8N_WEBHOOK_URL" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.error("[chat-log] Invalid JSON body received");
    return NextResponse.json(
      { error: "Invalid JSON body sent to /api/chat-log" },
      { status: 400 }
    );
  }

  console.log("[chat-log] Forwarding to n8n:", webhookUrl);
  console.log("[chat-log] Payload:", JSON.stringify(body).slice(0, 200));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const rawText = await n8nRes.text();

    if (!n8nRes.ok) {
      console.error(
        `[chat-log] n8n failed with status ${n8nRes.status}:`,
        rawText.slice(0, 300)
      );
      return NextResponse.json(
        {
          error: "n8n failed",
          status: n8nRes.status,
          raw: rawText?.slice(0, 500) ?? "",
        },
        { status: 502 }
      );
    }

    let parsed: unknown = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch (parseErr) {
      console.error("[chat-log] n8n returned non-JSON:", rawText.slice(0, 300));
      return NextResponse.json(
        {
          error: "n8n returned invalid JSON",
          raw: rawText.slice(0, 500),
        },
        { status: 502 }
      );
    }

    console.log("[chat-log] n8n response:", JSON.stringify(parsed).slice(0, 200));

    // Return the n8n response exactly as-is
    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    const details = err instanceof Error ? err.message : String(err);
    console.error(`[chat-log] Error calling n8n:`, details);
    return NextResponse.json(
      {
        error: isAbort ? "n8n timeout" : "Error calling n8n",
        details,
      },
      { status: 504 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
