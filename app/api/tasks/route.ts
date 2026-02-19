import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tasks, error } = await supabase
      .from("checkin_tasks")
      .select(
        `
        id,
        status,
        scheduled_for,
        sent_at,
        submitted_at,
        period_key,
        template:checkin_templates(template_key, title)
      `
      )
      .eq("user_id", user.id)
      .order("scheduled_for", { ascending: false });

    if (error) {
      console.error("Supabase query error:", error.message, error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(tasks || []);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("GET /api/tasks error:", errorMessage, err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
