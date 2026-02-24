import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type TemplateJoinRow = { template_key: string; title: string };
type TemplateJoin = TemplateJoinRow | TemplateJoinRow[] | null;
type TaskRowBase = {
  id: string;
  user_id: string;
  template_id: string;
  period_key: string;
  scheduled_for: string;
  sent_at: string;
  status: string;
  submitted_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
};
type TaskRowWithTemplate = TaskRowBase & { template?: TemplateJoin };

function normalizeTemplate(t: TemplateJoin | undefined): TemplateJoinRow | null {
  if (Array.isArray(t)) return t[0] ?? null;
  if (t) return t;
  return null;
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("checkin_tasks")
    .select(
      `
      id,
      user_id,
      template_id,
      period_key,
      scheduled_for,
      sent_at,
      status,
      submitted_at,
      reminder_sent_at,
      created_at,
      template:checkin_templates(template_key, title)
    `
    )
    .eq("id", taskId)
    .eq("user_id", user.id)
    .single();

  const task = data as TaskRowWithTemplate | null;

  if (error || !task) {
    return NextResponse.json(
      { error: "Task not found", detail: error?.message },
      { status: 404 }
    );
  }

  const tmpl = normalizeTemplate(task?.template);
  const mappedTask = {
    ...task,
    template_key: tmpl?.template_key ?? null,
    template_title: tmpl?.title ?? null,
  };

  return NextResponse.json({ task: mappedTask });
}
