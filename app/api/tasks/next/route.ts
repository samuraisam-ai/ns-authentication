import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const currentTotalMinutes = utcHours * 60 + utcMinutes;

    const todayYear = now.getUTCFullYear();
    const todayMonth = now.getUTCMonth();
    const todayDate = now.getUTCDate();
    const periodKey = `${todayYear}-${String(todayMonth + 1).padStart(2, "0")}-${String(todayDate).padStart(2, "0")}`;

    let templateKey: "daily_checkin" | "daily_checkout";
    let scheduledForDate: Date;

    const morningCutoff = 8 * 60 + 30; // 08:30
    const eveningCutoff = 16 * 60 + 45; // 16:45

    if (currentTotalMinutes < morningCutoff) {
      templateKey = "daily_checkin";
      scheduledForDate = new Date(Date.UTC(todayYear, todayMonth, todayDate, 8, 30, 0));
    } else if (currentTotalMinutes < eveningCutoff) {
      templateKey = "daily_checkout";
      scheduledForDate = new Date(Date.UTC(todayYear, todayMonth, todayDate, 16, 45, 0));
    } else {
      return NextResponse.json({ task: null, reason: "no_more_tasks_today" });
    }

    const { data: template, error: templateError } = await supabase
      .from("checkin_templates")
      .select("id, title")
      .eq("template_key", templateKey)
      .eq("active", true)
      .maybeSingle();

    if (templateError) {
      throw templateError;
    }

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 500 });
    }

    const { error: upsertError } = await supabase.from("checkin_tasks").upsert(
      {
        user_id: user.id,
        template_id: template.id,
        period_key: periodKey,
        scheduled_for: scheduledForDate.toISOString(),
      },
      {
        onConflict: "user_id,template_id,period_key",
        ignoreDuplicates: true,
      }
    );

    if (upsertError) {
      throw upsertError;
    }

    const { data: task, error: taskError } = await supabase
      .from("checkin_tasks")
      .select("id, status, scheduled_for, template_id")
      .eq("user_id", user.id)
      .eq("template_id", template.id)
      .eq("period_key", periodKey)
      .maybeSingle();

    if (taskError) {
      throw taskError;
    }

    if (!task) {
      throw new Error("Task not found after upsert");
    }

    return NextResponse.json({
      task: {
        id: task.id,
        status: task.status,
        scheduled_for: task.scheduled_for,
        template_key: templateKey,
        template_title: template.title,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
