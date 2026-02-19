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
  const taskId = getString(body?.taskId);
  const answers = body?.answers;

  if (!taskId || !answers) {
    return NextResponse.json(
      { error: "Missing taskId or answers" },
      { status: 400 }
    );
  }

  // Validate the task belongs to the user
  const { data: task, error: taskError } = await supabase
    .from("checkin_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .single();

  if (taskError || !task) {
    return NextResponse.json(
      { error: "Task not found or unauthorized" },
      { status: 404 }
    );
  }

  if (task.status === "submitted") {
    return NextResponse.json(
      { error: "Task already submitted" },
      { status: 400 }
    );
  }

  // Insert into checkin_submissions
  const submissionId = crypto.randomUUID();
  const { error: insertError } = await supabase
    .from("checkin_submissions")
    .insert({
      id: submissionId,
      task_id: taskId,
      user_id: user.id,
      answers,
      submitted_at: new Date().toISOString(),
    });

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to insert submission", detail: insertError.message },
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
    return NextResponse.json(
      { error: "Failed to update task status", detail: updateError.message },
      { status: 500 }
    );
  }

  // Optionally mark related notification as read if notification_id exists
  if (task.notification_id) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", task.notification_id)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ 
    ok: true, 
    submissionId,
    message: "Check-in submitted successfully" 
  });
}
