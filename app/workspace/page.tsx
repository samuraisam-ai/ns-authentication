import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import WorkspaceClient from "./workspace-client";
import type { User } from "@supabase/supabase-js";

export default async function WorkspacePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <WorkspaceClient user={user as User | null} />;
}


