"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";


type Props = { user: User | null };
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

export default function EmailPasswordDemo({ user: initialUser }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);
  const fromAuth = searchParams.get("fromAuth") === "1";
  const isAuthedAndAuthorized = isAuthorized(currentUser);

  const isActive = Boolean(currentUser);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (isAuthedAndAuthorized && !fromAuth) {
      router.replace("/workspace");
    }
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
    if (!error) router.push("/email-password?fromAuth=1");
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

        <section className="mt-6 rounded-[32px] bg-white p-8 shadow-[0_22px_70px_rgba(2,6,23,0.10)] ring-1 ring-slate-900/10">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                Flow
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Email + Password</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
                Classic credentials—users enter details, Supabase secures the rest while{" "}
                <span className="font-medium text-slate-800">getSession</span> +{" "}
                <span className="font-medium text-slate-800">onAuthStateChange</span> keep the UI live.
              </p>

              <ol className="mt-5 space-y-2 text-sm text-slate-700">
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Toggle between sign up and sign in.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Submit to watch the session card refresh instantly.
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

          <div className="mt-7 grid gap-6 lg:grid-cols-2">
            {/* Credentials */}
            {!currentUser ? (
              <div className="rounded-3xl border border-slate-900/10 bg-slate-50 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Credentials
                </p>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {mode === "signup" ? "Create an account" : "Welcome back"}
                  </h2>

                  <div className="flex rounded-full border border-slate-900/10 bg-white p-1 text-xs font-semibold">
                    {(["signup", "signin"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        aria-pressed={mode === m}
                        className={[
                          "rounded-full px-3 py-1.5 transition",
                          mode === m
                            ? "bg-emerald-500/15 text-emerald-800"
                            : "text-slate-600 hover:text-slate-900",
                        ].join(" ")}
                      >
                        {m === "signup" ? "Sign up" : "Sign in"}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Email
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@email.com"
                      className="mt-2 w-full rounded-2xl border border-slate-900/10 bg-white px-3 py-2.5 text-base text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      className="mt-2 w-full rounded-2xl border border-slate-900/10 bg-white px-3 py-2.5 text-base text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </label>

                  <button
                    type="submit"
                    className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    {mode === "signup" ? "Create account" : "Sign in"}
                  </button>

                  {status ? <p className="text-sm text-slate-600">{status}</p> : null}
                </form>
              </div>
            ) : (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-50 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  Signed in
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  You’re authenticated. Use the session panel to verify metadata.
                </p>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-slate-900/10 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                >
                  Sign out
                </button>

                {status ? <p className="mt-3 text-sm text-slate-600">{status}</p> : null}
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
            )}

            {/* Session */}
            <div className="rounded-3xl border border-slate-900/10 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Session
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {currentUser
                      ? "Hydrated by getSession + onAuthStateChange."
                      : "Sign in to hydrate this panel instantly."}
                  </p>
                </div>
                <span
                  className={[
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                    currentUser
                      ? "border-emerald-500/25 bg-emerald-50 text-emerald-700"
                      : "border-slate-900/10 bg-slate-50 text-slate-600",
                  ].join(" ")}
                >
                  {currentUser ? "Active" : "Idle"}
                </span>
              </div>

              {currentUser ? (
                <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-50/40 p-4">
                  <dl className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-6">
                      <dt className="text-slate-500">Email</dt>
                      <dd className="truncate font-medium text-slate-900">{currentUser.email}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-6">
                      <dt className="text-slate-500">User ID</dt>
                      <dd className="max-w-[18rem] truncate font-mono text-xs text-slate-800">
                        {currentUser.id}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-6">
                      <dt className="text-slate-500">Last sign in</dt>
                      <dd className="text-slate-800">
                        {currentUser.last_sign_in_at
                          ? new Date(currentUser.last_sign_in_at).toLocaleString()
                          : "N/A"}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-900/10 bg-slate-50 p-5 text-sm text-slate-500">
                  Session metadata will show up here after a successful sign in.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
