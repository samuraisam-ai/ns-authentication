import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getEnvironmentVariables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return { supabaseUrl, supabaseAnonKey };
}

function getAllowlists() {
  const rawEmails = process.env.ALLOWED_EMAILS ?? "";
  const rawDomains = process.env.ALLOWED_DOMAINS ?? "";

  const emails = rawEmails
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const domains = rawDomains
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  return { emails, domains };
}

function isAllowlisted(email: string | null | undefined) {
  const { emails, domains } = getAllowlists();
  if (emails.length === 0 && domains.length === 0) return true;
  if (!email) return false;

  const normalizedEmail = email.toLowerCase();
  if (emails.includes(normalizedEmail)) return true;

  return domains.some((domain) => {
    const normalized = domain.startsWith("@") ? domain.slice(1) : domain;
    return normalizedEmail.endsWith(`@${normalized}`);
  });
}

export async function middleware(request: NextRequest) {
  const { supabaseUrl, supabaseAnonKey } = getEnvironmentVariables();
  const response = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/email-password";

    const redirectResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  if (!isAllowlisted(user.email)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/email-password";
    redirectUrl.searchParams.set("error", "unauthorized");

    const redirectResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/workspace/:path*", "/tasks/:path*"],
};
