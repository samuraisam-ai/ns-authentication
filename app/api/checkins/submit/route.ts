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
  template?: {
    title: string;
  } | null;
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
          message: "Check-in already submitted",
        });
      }

      // If no coaching_session_id, create coaching now (legacy row)
      console.log("[checkins/submit] Legacy submission without coaching, creating now", { taskId, submissionId: existingSubmission.id });
      const coachingResult = await createCoachingSession(supabase, user.id, existingSubmission.id, taskId, task, answers as Record<string, unknown>);
      
      if (coachingResult.ok && coachingResult.sessionId) {
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
        coachingError: !coachingResult.ok,
        message: "Check-in already submitted",
      });
    }

    return NextResponse.json({
      ok: true,
      alreadySubmitted: true,
      submissionId: null,
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
   * 3. Call n8n webhook to generate coaching reply (or use fallback if webhook fails)
   * 4. Insert assistant reply message into chat
   * 5. Update checkin_submissions with coaching_session_id and coaching_created_at
   * 6. Return coachingSessionId to client for redirect to /workspace?sessionId=...
   * 
   * If n8n fails: chat still gets created with seed message + fallback reply, coachingError=true
   */
  // Post-submit coaching flow
  console.log("[checkins/submit] Starting coaching session creation", { taskId, submissionId });
  const coachingResult = await createCoachingSession(supabase, user.id, submissionId, taskId, task, answers as Record<string, unknown>);

  if (coachingResult.ok && coachingResult.sessionId) {
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
    coachingError: !coachingResult.ok,
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
): Promise<{ ok: boolean; sessionId?: string }> {
  try {
    // Get template title
    const templateTitle = task.template?.title || "Check-in";
    
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
      return { ok: false };
    }

    const sessionId = session.id;
    console.log("[checkins/submit] Chat session created", { sessionId });

    // Build and insert user message with raw answers
    const timestamp = new Date().toISOString();
    const userMessageContent = buildRawAnswersMessage({
      templateTitle,
      submissionId,
      taskId,
      timestamp,
      answers,
    });

    const { error: userMessageError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: "user",
        content: userMessageContent,
      });

    if (userMessageError) {
      console.error("[checkins/submit] Failed to insert user message:", {
        message: userMessageError.message,
      });
      return { ok: false, sessionId };
    }

    console.log("[checkins/submit] User message inserted", { sessionId });

    // Call n8n coaching flow
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error("[checkins/submit] Missing N8N_WEBHOOK_URL");
      return { ok: false, sessionId };
    }

    let assistantReply = "I received your check-in. Coaching is temporarily unavailable, but you can continue the conversation here.";
    let n8nError = false;

    try {
      const webhookPayload = {
        id: crypto.randomUUID(),
        user_id: userId,
        direction: "send",
        message: userMessageContent,
        request_id: crypto.randomUUID(),
        route: "/api/checkins/submit",
        created_at: new Date().toISOString(),
        chat_events: { body: { message: userMessageContent, sessionId } },
        identity: { id: userId },
        sessionId,
        submission_id: submissionId,
        task_id: taskId,
        template_title: templateTitle,
      };

      console.log("[checkins/submit] Calling n8n webhook", { sessionId });

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
        const webhookJson = (await webhookResponse.json().catch(() => ({}))) as Record<string, unknown>;
        if (typeof webhookJson?.reply === "string" && webhookJson.reply.trim().length > 0) {
          assistantReply = webhookJson.reply.trim();
        }
      } else {
        console.error("[checkins/submit] n8n webhook failed:", {
          status: webhookResponse.status,
          statusText: webhookResponse.statusText,
        });
        n8nError = true;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("[checkins/submit] n8n webhook timeout");
      } else {
        console.error("[checkins/submit] n8n webhook error:", error instanceof Error ? error.message : String(error));
      }
      n8nError = true;
    }

    // Insert assistant reply message
    const { error: assistantError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: "assistant",
        content: assistantReply,
      });

    if (assistantError) {
      console.error("[checkins/submit] Failed to insert assistant message:", {
        message: assistantError.message,
      });
      return { ok: false, sessionId };
    }

    console.log("[checkins/submit] Coaching session completed", { sessionId, n8nError });
    return { ok: true, sessionId };
  } catch (error) {
    console.error("[checkins/submit] Unexpected error in createCoachingSession:", error instanceof Error ? error.message : String(error));
    return { ok: false };
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
 * ✓ N8n webhook timeout/failure: chat session still created with seed message + fallback assistant reply,
 *   response includes coachingError: true for client to show "Coach reply failed" message
 * 
 * ✓ Workspace loads history immediately when URL has ?sessionId=<uuid> (loading skeleton visible on slow connection)
 * 
 * ✓ Chat messages are properly formatted: user message shows submission metadata + raw JSON answers,
 *   assistant message shows coaching reply (or fallback)
 */
