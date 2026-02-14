import GoogleLoginDemo from "./google-login-demo";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export default async function GoogleLoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("GoogleLoginPage user:", user);
  return <GoogleLoginDemo user={user} />;
}
