"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type Props = {
  user: User | null;
  defaultMode?: "signin" | "signup";
  copyVariant?: "signin" | "signup";
};
type Mode = "signup" | "signin";

function getAllowlists() {
  const rawEmails =
    process.env.NEXT_PUBLIC_ALLOWED_EMAILS ?? process.env.ALLOWED_EMAILS ?? "";
  const rawDomains =
    process.env.NEXT_PUBLIC_ALLOWED_DOMAINS ?? process.env.ALLOWED_DOMAINS ?? "";

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

function isEmailConfirmed(user: User | null) {
  if (!user) return false;
  const provider = user.app_metadata?.provider;
  if (provider === "google") return true;
  return Boolean(user.email_confirmed_at ?? user.confirmed_at);
}

function isAuthorized(user: User | null) {
  if (!user) return false;
  if (!isEmailConfirmed(user)) return false;

  const { emails, domains } = getAllowlists();
  if (emails.length === 0 && domains.length === 0) return true;

  const email = user.email?.toLowerCase();
  if (!email) return false;

  if (emails.includes(email)) return true;
  return domains.some((domain) => {
    const normalized = domain.startsWith("@") ? domain.slice(1) : domain;
    return email.endsWith(`@${normalized}`);
  });
}

const ACCENT = "#d8cd72";
const NS_LOGO =
  "https://res.cloudinary.com/dtjysgyny/image/upload/v1771966266/NS_Logos-01_1_2_snskdp.png";

export default function EmailPasswordDemo({
  user: initialUser,
  defaultMode = "signin",
  copyVariant = "signin",
}: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>(defaultMode);
  const isSignupCopy = copyVariant === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [status, setStatus] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);

  const fromAuth = searchParams.get("fromAuth") === "1";
  const isAuthedAndAuthorized = isAuthorized(currentUser);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!isAuthedAndAuthorized) return;
    const isOnRegisterPage = typeof window !== "undefined" && window.location.pathname === "/register";
    if (isOnRegisterPage) return;
    router.replace("/workspace?newChat=1");
  }, [fromAuth, isAuthedAndAuthorized, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/email-password?fromAuth=1` },
      });

      setStatus(error ? `Error: ${error.message}` : "Success: Check your inbox to confirm.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setStatus(error ? `Error: ${error.message}` : "Success: Signed in.");
    if (!error) router.replace("/workspace?newChat=1");
  }

  async function handleForgotPassword() {
    setStatus("");
    if (!email) {
      setStatus("Enter your email first, then click Forgot Password.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/email-password?fromAuth=1`,
    });

    setStatus(error ? `Error: ${error.message}` : "Password reset email sent (if the account exists).");
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="flex min-h-screen items-start justify-center px-0 pb-10 pt-20">
        <section className="w-full max-w-[420px] px-0">
          <div className="flex flex-col items-center text-center">
            <img
              src="https://res.cloudinary.com/dtjysgyny/image/upload/v1772450353/profile_badge_icon_transparent_okbfeo.png"
              alt="NetworkSpace logo"
              className="h-50 w-50 object-contain"
            />

            <h1 className="mt-2 text-[26px] tracking-tight text-black">
              <span className="font-bold">NS</span>{" "}
              <span className="font-medium">Coach</span>
            </h1>
            <p className="mt-1 text-[20px] font-bold" style={{ color: "#d8cd72" }}>
              Plan it. Do it. Show progress.
            </p>
          </div>

          <div className="mt-10 w-full bg-[#f4f4f4] py-8">
            <div className="px-12">
              <p className="text-center text-[16px] font-semibold text-black/70">
                Sign in to your account to continue
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-3">
              <label className="block text-[15px] font-semibold text-black">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                className="w-full rounded-md border border-black/25 bg-white px-4 py-2.5 text-[15px] text-black outline-none focus:border-black/40"
                style={{ caretColor: ACCENT }}
              />
              <style jsx global>{`
                input::placeholder {
                  color: ${ACCENT};
                  font-style: italic;
                  font-weight: 600;
                  opacity: 1;
                }
              `}</style>
            </div>

            <div className="space-y-3">
              <label className="block text-[15px] font-semibold text-black">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Enter your password"
                className="w-full rounded-md border border-black/25 bg-white px-4 py-2.5 text-[15px] text-black outline-none focus:border-black/40"
                style={{ caretColor: ACCENT }}
              />

              <Link
                href="/coming-soon"
                className="mt-2 inline-block text-left text-[14px] italic text-black/40 hover:text-black/60"
              >
                Forgot Password?
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3 w-3 rounded border border-black/25"
                style={{ accentColor: ACCENT }}
              />
              <label htmlFor="remember" className="text-[14px] font-semibold text-black/60">
                Remember me next time
              </label>
            </div>

            <div className="flex justify-center">
              <button
                type="submit"
                className="rounded-lg px-10 py-3 text-[16px] font-semibold text-white shadow-sm active:translate-y-[1px]"
                style={{ backgroundColor: ACCENT }}
              >
                {isSignupCopy ? "Sign up" : "Sign in"}
              </button>
            </div>

            <div className="text-center text-[14px] font-semibold text-black/55">
              {isSignupCopy ? "Already have an account? " : "Need an account, "}
              <Link
                href={isSignupCopy ? "/" : "/register"}
                className="text-black/70 hover:text-black underline underline-offset-4"
              >
                {isSignupCopy ? "Sign in" : "register"}
              </Link>
            </div>

              {status ? (
                <p className="text-center text-[13px] text-black/60">{status}</p>
              ) : null}
            </form>
            </div>
          </div>
        </section>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-[#545454] py-1">
        <div className="mx-auto flex max-w-[420px] items-center justify-center gap-2 px-6">
          <p className="text-2xl tracking-tight text-white">
            <span className="font-bold">NS</span>{" "}
            <span className="font-medium">Coach</span>
          </p>
        </div>
      </footer>
    </main>
  );
}
