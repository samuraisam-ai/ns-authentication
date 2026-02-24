import EmailPasswordDemo from "@/app/email-password/email-password-demo";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Render the login UI at "/"
  return <EmailPasswordDemo user={user} />;
}
