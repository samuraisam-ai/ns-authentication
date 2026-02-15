"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type Props = { user: User | null };

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

export default function GoogleLoginDemo({ user: initialUser }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);
  const [status, setStatus] = useState<string>("");
  const fromAuth = searchParams.get("fromAuth") === "1";
  const isAuthedAndAuthorized = isAuthorized(currentUser);

  const isActive = Boolean(currentUser);

  useEffect(() => {
    // Live session listener (keeps UI synced)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (isAuthedAndAuthorized && !fromAuth) {
      router.replace("/workspace");
    }
  }, [fromAuth, isAuthedAndAuthorized, router]);

  async function handleGoogleLogin() {
    setStatus("");

    const redirectTo = `${window.location.origin}/google-login?fromAuth=1`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) setStatus(`Error: ${error.message}`);
  }

  async function handleSignOut() {
    setStatus("");
    const { error } = await supabase.auth.signOut();
    if (error) setStatus(`Error: ${error.message}`);
    else {
      setCurrentUser(null);
      setStatus("Signed out successfully.");
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* subtle futuristic background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(16,185,129,0.14),transparent_35%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_40%,rgba(2,6,23,0.08),transparent_45%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.02),transparent_30%,rgba(2,6,23,0.02))]" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-6 py-10">
        <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">
          ← Back to Home
        </Link>

        <div className="mt-6 grid gap-6">
          {/* Main card */}
          <section className="rounded-[32px] bg-white p-8 shadow-[0_22px_70px_rgba(2,6,23,0.10)] ring-1 ring-slate-900/10">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Flow
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Google Login</h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
                  OAuth login with Supabase and a live session listener to keep the UI synced.
                </p>

                <ol className="mt-5 space-y-2 text-sm text-slate-700">
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Start the OAuth redirect with Google.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Return to see the session panel hydrate.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Sign out to reset the listener.
                  </li>
                </ol>
              </div>

              <div className="shrink-0">
                <span
                  className={[
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                    isActive
                      ? "border-emerald-500/25 bg-emerald-50 text-emerald-700"
                      : "border-slate-900/10 bg-slate-50 text-slate-600",
                  ].join(" ")}
                >
                  {isActive ? "Active" : "Idle"}
                </span>
              </div>
            </div>

            {/* OAuth box (matches your sketch) */}
            <div className="mt-7 rounded-3xl border border-slate-900/10 bg-slate-50 p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    OAuth
                  </p>
                  <p className="mt-2 text-sm text-slate-700">Use Google to sign in.</p>
                </div>

                {currentUser ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="rounded-full border border-slate-900/10 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                  >
                    Sign out
                  </button>
                ) : null}
              </div>

              {!currentUser ? (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  Continue with Google
                </button>
              ) : (
                <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                    Session
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-800">
                    <div className="flex items-center justify-between gap-6">
                      <span className="text-slate-500">Email</span>
                      <span className="truncate font-medium">{currentUser.email}</span>
                    </div>
                    <div className="flex items-center justify-between gap-6">
                      <span className="text-slate-500">User ID</span>
                      <span className="max-w-[18rem] truncate font-mono text-xs">{currentUser.id}</span>
                    </div>
                  </div>
                </div>
              )}

              {status ? (
                <p className="mt-4 text-sm text-slate-600">
                  {status}
                </p>
              ) : null}

              {isAuthedAndAuthorized && fromAuth ? (
                <button
                  type="button"
                  onClick={() => router.push("/workspace")}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  Continue
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
