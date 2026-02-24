import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import CheckinTaskClient from "./checkin-task-client";

export default async function CheckinTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/");

  const { taskId } = await params;

  return <CheckinTaskClient taskId={taskId} userId={user.id} />;
}
