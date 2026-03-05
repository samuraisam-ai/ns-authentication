import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import ChatsClient from "./chats-client";

export default async function ChatsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/");

  return <ChatsClient />;
}
