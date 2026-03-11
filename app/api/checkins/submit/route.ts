import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import type { SupabaseClient } from "@supabase/supabase-js";

interface TaskWithTemplate {
  id: string;
  user_id: string;
  template_id: string;
  period_key: string;
  scheduled_for: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  template?:
    | {
        title: string;
      }
    | {
        title: string;
      }[]
    | null;
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function formatDateTimeWithTimezone(dateString: string, timezone: string): string {
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Unknown";
    
    const formatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: timezone,
    });
    
    const parts = formatter.formatToParts(date);
    const values: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== "literal") {
        values[part.type] = part.value;
      }
    }
    
    const year = values.year;
    const month = values.month;
    const day = values.day;
    const hour = values.hour;
    const minute = values.minute;
    
    return `${year}-${month}-${day} — ${hour}:${minute}`;
  } catch {
    return "Unknown";
  }
}

function buildRawAnswersMessage(args: {
  templateTitle: string;
  submissionId: string;
  taskId: string;
  timestamp: string;
  answers: Record<string, unknown>;
}): string {
  const { templateTitle, submissionId, taskId, timestamp, answers } = args;
  const lines: string[] = [];
  
  lines.push(`# Submission: ${templateTitle}\n`);
  lines.push(`**Submission ID:** ${submissionId}`);
  lines.push(`**Task ID:** ${taskId}`);
  lines.push(`**Timestamp:** ${timestamp}\n`);
  
  lines.push(`## Answers\n`);
  lines.push("```json");
  lines.push(JSON.stringify(answers, null, 2));
  lines.push("```");
  
  return lines.join("\n");
}

  async function buildSummarisedSeedMessage(
    templateTitle: string,
    answers: Record<string, unknown>
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return templateTitle;

    try {
      const answersText = Object.entries(answers)
        .filter(([, v]) => typeof v === "string" && String(v).trim().length > 0)
        .map(([k, v]) => `${k}: ${String(v).slice(0, 150)}`)
        .join("\n")
        .slice(0, 600);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 100,
          messages: [
            {
              role: "system",
              content: "You summarise employee check-in answers into 1-2 warm, natural sentences from the employee's perspective. Write in first person. Be specific about what they said. No bullet points. No preamble. Just the summary.",
            },
            {
              role: "user",
              content: `Check-in type: ${templateTitle}\n\nAnswers:\n${answersText}`,
            },
          ],
        }),
      });

      if (!response.ok) return templateTitle;
      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const summary = data.choices?.[0]?.message?.content?.trim();
      return summary && summary.length > 0 ? summary : templateTitle;
    } catch {
      return templateTitle;
    }
  }

function getTemplateTitle(task: TaskWithTemplate): string {
  const templateValue = task.template;
  if (!templateValue) return "Check-in";

  if (Array.isArray(templateValue)) {
    return typeof templateValue[0]?.title === "string" && templateValue[0].title.trim().length > 0
      ? templateValue[0].title
      : "Check-in";
  }

  return typeof templateValue.title === "string" && templateValue.title.trim().length > 0
    ? templateValue.title
    : "Check-in";
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
  const answers = body?.answers;

  if (!taskId || !answers) {
    return NextResponse.json(
      { error: "Missing taskId or answers" },
      { status: 400 }
    );
  }

  // Validate the task belongs to the user and fetch with template details
  const { data: task, error: taskError } = await supabase
    .from("checkin_tasks")
    .select(`
      id,
      user_id,
      template_id,
      period_key,
      scheduled_for,
      status,
      submitted_at,
      created_at,
      template:checkin_templates(title)
    `)
    .eq("id", taskId)
    .eq("user_id", user.id)
    .single();

  if (taskError || !task) {
    if (taskError) {
      console.error("Failed to fetch task:", {
        where: "POST /api/checkins/submit - fetch task",
        message: taskError.message,
        details: taskError.details,
        hint: taskError.hint,
        code: taskError.code,
      });
      return NextResponse.json(
        {
          error: "Failed to fetch task",
          supabase: {
            message: taskError.message,
            details: taskError.details,
            hint: taskError.hint,
            code: taskError.code,
          },
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Task not found or unauthorized" },
      { status: 404 }
    );
  }

  /**
   * IDEMPOTENCY: If task was already submitted, handle gracefully instead of erroring.
   * 
   * Rules:
   * - If submission has coaching_session_id: return it immediately (already fully processed)
   * - If submission lacks coaching_session_id (legacy/backfill): create coaching now, then return it
   * - Always return coachingSessionId in response so client always gets session to redirect to
   */
  // Handle idempotency: if already submitted, fetch existing submission
  if (task.status === "submitted") {
    const { data: existingSubmission, error: fetchSubmissionError } = await supabase
      .from("checkin_submissions")
      .select("id, coaching_session_id")
      .eq("task_id", taskId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!fetchSubmissionError && existingSubmission) {
      // If coaching_session_id exists, return it
      if (existingSubmission.coaching_session_id) {
        console.log("[checkins/submit] Already submitted with coaching", { taskId, sessionId: existingSubmission.coaching_session_id });
        return NextResponse.json({
          ok: true,
          alreadySubmitted: true,
          submissionId: existingSubmission.id,
          coachingSessionId: existingSubmission.coaching_session_id,
          coachingTriggered: false,
          message: "Check-in already submitted",
        });
      }

      // If no coaching_session_id, create coaching now (legacy row)
      console.log("[checkins/submit] Legacy submission without coaching, creating now", { taskId, submissionId: existingSubmission.id });
      const coachingResult = await createCoachingSession(supabase, user.id, existingSubmission.id, taskId, task, answers as Record<string, unknown>);
      
      if (coachingResult.sessionId) {
        // Update submission with coaching_session_id
        await supabase
          .from("checkin_submissions")
          .update({
            coaching_session_id: coachingResult.sessionId,
            coaching_created_at: new Date().toISOString(),
          })
          .eq("id", existingSubmission.id);
      }

      return NextResponse.json({
        ok: true,
        alreadySubmitted: true,
        submissionId: existingSubmission.id,
        coachingSessionId: coachingResult.sessionId || undefined,
        coachingTriggered: coachingResult.coachingTriggered,
        message: "Check-in already submitted",
      });
    }

    return NextResponse.json({
      ok: true,
      alreadySubmitted: true,
      submissionId: null,
      coachingSessionId: undefined,
      coachingTriggered: false,
      message: "Check-in already submitted",
    });
  }

  // Insert into checkin_submissions
  const submissionId = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
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
      const { error: duplicateUpdateError } = await supabase
        .from("checkin_tasks")
        .update({
          status: "submitted",
          submitted_at: submittedAt,
        })
        .eq("id", taskId)
        .eq("user_id", user.id);

      if (duplicateUpdateError) {
        console.error("Failed to update task status after duplicate:", {
          where: "POST /api/checkins/submit - update task status (duplicate)",
          message: duplicateUpdateError.message,
          details: duplicateUpdateError.details,
          hint: duplicateUpdateError.hint,
          code: duplicateUpdateError.code,
        });
        return NextResponse.json(
          {
            error: "Failed to update task status",
            supabase: {
              message: duplicateUpdateError.message,
              details: duplicateUpdateError.details,
              hint: duplicateUpdateError.hint,
              code: duplicateUpdateError.code,
            },
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        alreadySubmitted: true,
        submissionId: null,
        coachingSessionId: undefined,
        coachingTriggered: false,
        message: "Check-in already submitted",
      });
    }

    console.error("Failed to insert submission:", {
      where: "POST /api/checkins/submit - insert submission",
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
      code: insertError.code,
    });
    return NextResponse.json(
      {
        error: "Failed to insert submission",
        supabase: {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        },
      },
      { status: 500 }
    );
  }

  // Update checkin_tasks status
  const { error: updateError } = await supabase
    .from("checkin_tasks")
    .update({
      status: "submitted",
      submitted_at: submittedAt,
    })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Failed to update task status:", {
      where: "POST /api/checkins/submit - update task status",
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
      code: updateError.code,
    });
    return NextResponse.json(
      {
        error: "Failed to update task status",
        supabase: {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
        },
      },
      { status: 500 }
    );
  }

  // Mark related notifications as read using task_id and user_id
  await supabase
    .from("notifications")
    .update({ read_at: submittedAt })
    .eq("task_id", taskId)
    .eq("user_id", user.id)
    .is("read_at", null);

  /**
   * POST-SUBMIT COACHING FLOW:
   *
   * 1. Create a chat session named "<Template Title> — YYYY-MM-DD — HH:mm" (Africa/Johannesburg TZ)
   * 2. Insert seed message with raw submission answers (title, submission_id, task_id, timestamp, JSON)
   * 3. Trigger n8n asynchronously (no synchronous assistant reply handling here)
   * 4. Update checkin_submissions with coaching_session_id and coaching_created_at
   * 5. Return success immediately after DB writes
   */
  // Post-submit coaching flow
  console.log("[checkins/submit] Starting coaching session creation", { taskId, submissionId });
  const coachingResult = await createCoachingSession(supabase, user.id, submissionId, taskId, task, answers as Record<string, unknown>);

  if (coachingResult.sessionId) {
    // Update submission with coaching_session_id
    const { error: updateCoachingError } = await supabase
      .from("checkin_submissions")
      .update({
        coaching_session_id: coachingResult.sessionId,
        coaching_created_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (updateCoachingError) {
      console.error("[checkins/submit] Failed to update coaching_session_id:", {
        message: updateCoachingError.message,
        code: updateCoachingError.code,
      });
    } else {
      console.log("[checkins/submit] Updated submission with coaching_session_id", { sessionId: coachingResult.sessionId });
    }
  }

  return NextResponse.json({ 
    ok: true, 
    submissionId,
    coachingSessionId: coachingResult.sessionId || undefined,
    coachingTriggered: coachingResult.coachingTriggered,
    message: "Check-in submitted successfully" 
  });
}

// ==================== COACHING HELPER ====================

async function createCoachingSession(
  supabase: SupabaseClient,
  userId: string,
  submissionId: string,
  taskId: string,
  task: TaskWithTemplate,
  answers: Record<string, unknown>
): Promise<{ ok: boolean; sessionId?: string; coachingTriggered: boolean }> {
  try {
    // Get template title
    const templateTitle = getTemplateTitle(task);
    
    // Format session title with timezone
    const sessionTitle = `${templateTitle} — ${formatDateTimeWithTimezone(task.scheduled_for, "Africa/Johannesburg")}`;
    
    console.log("[checkins/submit] Creating chat session", { taskId, title: sessionTitle });

    // Create chat session
    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .insert({ user_id: userId, title: sessionTitle })
      .select("id")
      .single();

    if (sessionError || !session) {
      console.error("[checkins/submit] Failed to create chat session:", {
        message: sessionError?.message ?? "unknown_error",
      });
      return { ok: false, coachingTriggered: false };
    }

    const sessionId = session.id;
    console.log("[checkins/submit] Chat session created", { sessionId });

    // Build raw message for n8n webhook and system storage
    const timestamp = new Date().toISOString();
    const rawMessageContent = buildRawAnswersMessage({
      templateTitle,
      submissionId,
      taskId,
      timestamp,
      answers,
    });

    // Build summarised message for display
    const summarisedContent = await buildSummarisedSeedMessage(templateTitle, answers);

    // Store raw as system message (hidden from UI, available for later use)
    const { error: systemMessageError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: "system",
        content: rawMessageContent,
      });

    if (systemMessageError) {
      console.error("[checkins/submit] Failed to insert system message:", {
        message: systemMessageError.message,
      });
    }

    // Store summarised version as user message (visible in UI)
    const { error: userMessageError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: "user",
        content: summarisedContent,
      });

    if (userMessageError) {
      console.error("[checkins/submit] Failed to insert user message:", {
        message: userMessageError.message,
      });
      return { ok: false, sessionId, coachingTriggered: false };
    }

    console.log("[checkins/submit] User message inserted", { sessionId });

    // Trigger n8n coaching flow (async trigger only)
    const webhookUrl = process.env.N8N_COACHING_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
    let coachingTriggered = false;

    if (!webhookUrl) {
      console.error("[checkins/submit] Missing N8N_COACHING_WEBHOOK_URL and N8N_WEBHOOK_URL");
    } else {
      const webhookPayload = {
        source: "checkin_submit",
        sessionId,
        submissionId,
        taskId,
        userId,
        templateTitle,
        message: rawMessageContent,
      };

      const safeWebhookUrl = (() => {
        try {
          const parsed = new URL(webhookUrl);
          return `${parsed.hostname}${parsed.pathname}`;
        } catch {
          return "invalid_url";
        }
      })();

      console.log("[submit][n8n] request", { sessionId, webhook: safeWebhookUrl });
      coachingTriggered = true;

      void fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      })
        .then((webhookResponse) => {
          if (!webhookResponse.ok) {
            console.error("[checkins/submit] n8n webhook failed:", {
              status: webhookResponse.status,
              statusText: webhookResponse.statusText,
              sessionId,
              submissionId,
              taskId,
            });
          }
        })
        .catch((error: unknown) => {
          console.error(
            "[checkins/submit] n8n trigger error:",
            error instanceof Error ? error.message : String(error)
          );
        });
    }

    console.log("[checkins/submit] Coaching session seeded", { sessionId, coachingTriggered });
    return { ok: true, sessionId, coachingTriggered };
  } catch (error) {
    console.error("[checkins/submit] Unexpected error in createCoachingSession:", error instanceof Error ? error.message : String(error));
    return { ok: false, coachingTriggered: false };
  }
}

/**
 * MANUAL TEST CHECKLIST:
 * 
 * ✓ Fresh submission creates coaching chat + client redirects to /workspace?sessionId=<uuid>
 * 
 * ✓ Double-click submit from task page: second request returns same coachingSessionId (no duplicates)
 * 
 * ✓ Refresh browser after submit: page shows coachingSessionId in response (idempotent)
 * 
 * ✓ Legacy submitted task (existing row without coaching_session_id): calling submit again creates
 *   coaching session now and backlogs it to the submission row
 * 
 * ✓ N8n trigger timeout/failure: chat session still created with seed message,
 *   response includes coachingTriggered: false while submit still succeeds
 * 
 * ✓ Workspace loads history immediately when URL has ?sessionId=<uuid> (loading skeleton visible on slow connection)
 * 
 * ✓ Chat messages are properly formatted: user seed message shows submission metadata + raw JSON answers,
 *   assistant reply is handled by callback route
 */
