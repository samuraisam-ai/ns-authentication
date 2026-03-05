import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

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

  // Fetch the task and validate ownership
  const { data: task, error: taskError } = await supabase
    .from("checkin_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .single();

  if (taskError || !task) {
    if (taskError) {
      console.error("[checkins-submit-and-coach] Failed to fetch task:", {
        message: taskError.message,
        code: taskError.code,
      });
    }
    return NextResponse.json(
      { error: "Task not found or unauthorized" },
      { status: 404 }
    );
  }

  // Check if already submitted
  if (task.status === "submitted") {
    return NextResponse.json(
      { error: "Already submitted" },
      { status: 409 }
    );
  }

  // Extract answers from body
  const answers = body?.answers as Record<string, unknown> | undefined;
  if (!answers) {
    return NextResponse.json({ error: "Missing answers" }, { status: 400 });
  }

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
      // Duplicate submission - ensure task is marked submitted
      await supabase
        .from("checkin_tasks")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("user_id", user.id);

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

  // Update checkin_tasks status
  const { error: updateError } = await supabase
    .from("checkin_tasks")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("[checkins-submit-and-coach] Failed to update task status:", {
      message: updateError.message,
      code: updateError.code,
    });
    return NextResponse.json(
      { error: "Failed to update task status" },
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

  const webhookPayload = {
    source: "checkin_submit",
    userId: user.id,
    taskId: taskId,
    templateKey: task.template_key ?? "unknown",
    scheduledFor: task.scheduled_for,
    sessionId: sessionId,
    userMessageId: userMessageId,
    answers: answers,
  };

  let assistantReply =
    "I received your check-in, but coaching is temporarily unavailable. Try again in a minute.";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(webhookPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (webhookResponse.ok) {
      const responseData = (await webhookResponse
        .json()
        .catch(() => ({}))) as Record<string, unknown>;
      const reply = responseData?.reply;

      if (typeof reply === "string" && reply.trim()) {
        assistantReply = reply.trim();
      } else {
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

  // ==================== INSERT SECOND ASSISTANT MESSAGE (WITH REPLY) ====================
  const { error: assistantMessageError } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      role: "assistant",
      content: assistantReply,
    });

  if (assistantMessageError) {
    console.error("[checkins-submit-and-coach] Failed to insert assistant message:", {
      message: assistantMessageError.message,
    });
    return NextResponse.json(
      { error: "Failed to store assistant message" },
      { status: 500 }
    );
  }

  return NextResponse.json({ sessionId });
}
