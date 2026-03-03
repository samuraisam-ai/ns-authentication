import EmailPasswordDemo from "@/app/email-password/email-password-demo";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export default async function RegisterPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <EmailPasswordDemo user={user} defaultMode="signup" copyVariant="signup" />;
}
