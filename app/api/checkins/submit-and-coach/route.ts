import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { logChatEvent, newRequestId } from "@/lib/chat-events";

/**
 * Manual Acceptance Tests:
 * 
 * 1. Submit once → new chat opens with assistant reply (from n8n reply)
 * 2. Double-click submit → second call gets 409, no duplicate submission
 * 3. Simulate webhook failure → chat still opens with fallback assistant message
 * 4. /chats shows the new session with Check-in — / Check-out — title
 */

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return "Unknown date";
  }
}

function formatDateShort(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Unknown";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "Unknown";
  }
}

function getSessionTitlePrefix(templateKey: string): string {
  if (templateKey === "daily_checkin") return "Check-in";
  if (templateKey === "daily_checkout") return "Check-out";
  if (templateKey === "weekly_checkin" || templateKey === "weekly_checkout") return "Check-out";
  return "Check-in";
}

function buildCheckinSummary(
  templateKey: string,
  templateTitle: string,
  scheduledFor: string,
  answers: Record<string, unknown>
): string {
  const formattedDate = formatDate(scheduledFor);
  const titlePrefix = getSessionTitlePrefix(templateKey);
  const templateName = templateTitle || titlePrefix;

  let summary = `# ${templateName}\n**Scheduled:** ${formattedDate}\n\n`;

  if (templateKey === "daily_checkin") {
    const priorities = getString(answers.priorities);
    if (priorities) {
      summary += `**My Priorities:**\n${priorities}\n`;
    }
  } else if (templateKey === "daily_checkout") {
    const accomplishments = getString(answers.accomplishments);
    if (accomplishments) {
      summary += `**What I Accomplished:**\n${accomplishments}\n\n`;
    }

    const statuses = answers.statuses as Record<string, string> | undefined;
    if (statuses) {
      summary += `**Status:**\n`;
      if (statuses.status_1) summary += `- Task 1: ${statuses.status_1}\n`;
      if (statuses.status_2) summary += `- Task 2: ${statuses.status_2}\n`;
      if (statuses.status_3) summary += `- Task 3: ${statuses.status_3}\n`;
      summary += `\n`;
    }

    const energyLevel = answers.energy_level;
    if (energyLevel !== undefined) {
      summary += `**Energy Level:** ${energyLevel}/10\n\n`;
    }
  } else if (templateKey === "weekly_checkin" || templateKey === "weekly_checkout") {
    const leadsCount = answers.leads_count;
    const leadsExplanation = getString(answers.leads_explanation);
    const viewingsCount = answers.viewings_count;
    const viewingsExplanation = getString(answers.viewings_explanation);
    const leasesCount = answers.leases_count;
    const leasesExplanation = getString(answers.leases_explanation);

    summary += `**Leads Created:** ${leadsCount ?? "N/A"}\n${leadsExplanation ? `${leadsExplanation}\n\n` : "\n"}`;
    summary += `**Viewings Attended:** ${viewingsCount ?? "N/A"}\n${viewingsExplanation ? `${viewingsExplanation}\n\n` : "\n"}`;
    summary += `**Leases Signed:** ${leasesCount ?? "N/A"}\n${leasesExplanation ? `${leasesExplanation}\n\n` : "\n"}`;
  }

  return summary.trim();
}

function flattenAnswers(obj: unknown, prefix = ""): Array<[string, string]> {
  if (!obj || typeof obj !== "object") return [];

  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;

    if (v === null || v === undefined) continue;

    if (typeof v === "object" && !Array.isArray(v)) {
      out.push(...flattenAnswers(v, key));
      continue;
    }

    if (Array.isArray(v)) {
      out.push([key, v.map(String).join(", ")]);
      continue;
    }

    out.push([key, String(v)]);
  }

  return out;
}

function buildAnswersMessage(args: {
  templateKey: string;
  scheduledForISO?: string | null;
  answers: Record<string, unknown>;
}) {
  const { templateKey, scheduledForISO, answers } = args;

  const scheduledFor = scheduledForISO
    ? new Date(scheduledForISO).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const lines: string[] = [];
  lines.push(`Check-in submission`);
  lines.push(`Template: ${templateKey}`);
  lines.push(`Scheduled for: ${scheduledFor}`);
  lines.push("");
  lines.push("Answers:");

  const flat = flattenAnswers(answers);
  if (flat.length === 0) {
    lines.push("- (no answers found)");
  } else {
    for (const [k, v] of flat) lines.push(`- ${k}: ${v}`);
  }

  return lines.join("\n");
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
  const taskId = getString(body?.taskId);

  if (!taskId) {
    return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
  }

  // Extract answers from body
  const answers = body?.answers as Record<string, unknown> | undefined;
  if (!answers) {
    return NextResponse.json({ error: "Missing answers" }, { status: 400 });
  }

  // Atomic idempotency guard: lock task by moving pending -> submitted in one statement
  const submittedAt = new Date().toISOString();
  const { data: updatedTask, error: updErr } = await supabase
    .from("checkin_tasks")
    .update({ status: "submitted", submitted_at: submittedAt })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("*")
    .single();

  if (updErr || !updatedTask) {
    return NextResponse.json({ error: "Already submitted" }, { status: 409 });
  }

  const task = updatedTask;

  // ==================== SUBMISSION LOGIC ====================
  // Insert into checkin_submissions
  const submissionId = crypto.randomUUID();
  const { error: insertError } = await supabase
    .from("checkin_submissions")
    .insert({
      id: submissionId,
      task_id: taskId,
      user_id: user.id,
      answers_json: answers,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Already submitted" },
        { status: 409 }
      );
    }

    console.error("[checkins-submit-and-coach] Failed to insert submission:", {
      message: insertError.message,
      code: insertError.code,
    });
    return NextResponse.json(
      { error: "Failed to insert submission" },
      { status: 500 }
    );
  }

  // Mark notification as read if exists
  if (task.notification_id) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", task.notification_id)
      .eq("user_id", user.id);
  }

  // ==================== CREATE CHAT SESSION ====================
  const scheduledDate = formatDateShort(task.scheduled_for);
  const titlePrefix = getSessionTitlePrefix(task.template_key ?? "daily_checkin");
  const sessionTitle = `${titlePrefix} — ${scheduledDate}`;

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .insert({ user_id: user.id, title: sessionTitle })
    .select("id")
    .single();

  if (sessionError || !session) {
    console.error("[checkins-submit-and-coach] Failed to create chat session:", {
      message: sessionError?.message ?? "unknown_error",
    });
    return NextResponse.json(
      { error: "Failed to create chat session" },
      { status: 500 }
    );
  }

  const sessionId = session.id;

  // ==================== INSERT USER MESSAGE ====================
  const userMessageContent = buildCheckinSummary(
    task.template_key ?? "unknown",
    task.template_title ?? "Check-in",
    task.scheduled_for,
    answers
  );

  const { data: userMessage, error: userMessageError } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      role: "user",
      content: userMessageContent,
    })
    .select("id")
    .single();

  if (userMessageError || !userMessage) {
    console.error("[checkins-submit-and-coach] Failed to insert user message:", {
      message: userMessageError?.message ?? "unknown_error",
    });
    return NextResponse.json(
      { error: "Failed to store user message" },
      { status: 500 }
    );
  }

  const userMessageId = userMessage.id;

  // ==================== INSERT INITIAL ASSISTANT MESSAGE ====================
  const { error: initialAssistantError } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      role: "assistant",
      content: "Got it — generating coaching advice…",
    });

  if (initialAssistantError) {
    console.error("[checkins-submit-and-coach] Failed to insert initial assistant message:", {
      message: initialAssistantError.message,
    });
  }

  // ==================== CALL N8N WEBHOOK ====================
  const webhookUrl =
    "https://n8n.srv1232006.hstgr.cloud/webhook/2b529379-023f-4969-9367-4ab5d6593b02";

  const templateKey = task.template_key ?? "unknown";
  const requestId = newRequestId();
  const createdAt = new Date().toISOString();

  const combinedMessage = buildAnswersMessage({
    templateKey,
    scheduledForISO: task.scheduled_for,
    answers,
  });

  const webhookPayload = {
    source: "checkin_submit",
    // IDs / routing
    userId: user.id,
    taskId: taskId,
    templateKey: templateKey,
    scheduledFor: task.scheduled_for,
    sessionId: sessionId,
    userMessageId: userMessageId,
    answers: answers,
    // snake_case aliases (for n8n)
    user_id: user.id,
    task_id: taskId,
    template_key: templateKey,
    scheduled_for: task.scheduled_for,
    session_id: sessionId,
    user_message_id: userMessageId,
    // chat_events required fields
    direction: "send",
    message: combinedMessage,
    request_id: requestId,
    route: "checkins/submit-and-coach",
    created_at: createdAt,
  };

  // Defensive assertion: ensure direction is "send" before calling n8n
  if (webhookPayload.direction !== "send") {
    console.error(
      "[checkins-submit-and-coach] Invalid direction for n8n webhook:",
      webhookPayload.direction
    );
    return NextResponse.json(
      { error: "Invalid payload direction" },
      { status: 500 }
    );
  }

  await logChatEvent({
    userId: user.id,
    direction: "send",
    message: `checkin_submit -> n8n (task_id=${taskId}, session_id=${sessionId})`,
    requestId,
    route: "checkins/submit-and-coach",
  });

  let webhookJson: Record<string, unknown> | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (webhookResponse.ok) {
      webhookJson = (await webhookResponse
        .json()
        .catch(() => ({}))) as Record<string, unknown>;

      if (!(typeof webhookJson?.reply === "string" && webhookJson.reply.trim().length > 0)) {
        console.warn("[checkins-submit-and-coach] n8n response missing reply field");
      }
    } else {
      console.error("[checkins-submit-and-coach] n8n webhook failed:", {
        status: webhookResponse.status,
        statusText: webhookResponse.statusText,
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[checkins-submit-and-coach] n8n webhook timeout");
    } else {
      console.error(
        "[checkins-submit-and-coach] n8n webhook error:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  const coachingReply =
    typeof webhookJson?.reply === "string" && webhookJson.reply.trim().length > 0
      ? webhookJson.reply.trim()
      : "I received your check-in, but coaching is temporarily unavailable. Try again in a minute.";

  // ==================== INSERT SECOND ASSISTANT MESSAGE (WITH REPLY) ====================
  const { data: assistantMsg, error: assistantErr } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      role: "assistant",
      content: coachingReply,
    })
    .select("id")
    .single();

  if (assistantErr) {
    console.error("[checkins-submit-and-coach] failed to insert assistant message", assistantErr);
  }

  await logChatEvent({
    userId: user.id,
    direction: "receive",
    message: `n8n reply received (len=${coachingReply.length})`,
    requestId,
    route: "checkins/submit-and-coach",
  });

  return NextResponse.json({ sessionId });
}
