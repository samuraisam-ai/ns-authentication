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
  const notificationId = getString(body?.notificationId);

  if (!notificationId) {
    return NextResponse.json(
      { error: "Missing notificationId" },
      { status: 400 }
    );
  }

  // Mark as read - ensure it belongs to the authenticated user
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to mark notification as read", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
