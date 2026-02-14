"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { AuthDemoPage } from "@/app/components/auth-demo-page";

type EmailPasswordDemoProps = { user: User | null };
type Mode = "signup" | "signin";

export default function EmailPasswordDemo({ user }: EmailPasswordDemoProps) {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const supabase = getSupabaseBrowserClient();
  const [currentUser, setCurrentUser] = useState<User | null>(user);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setStatus("Signed out successfully");
  }

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // If your tutorial uses /welcome, keep this. Otherwise change to /email-password.
          emailRedirectTo: `${window.location.origin}/welcome`,
        },
      });

      setStatus(error ? error.message : "Check your inbox to confirm the new account.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setStatus(error ? error.message : "Signed in successfully");
  }

  return (
    <AuthDemoPage
      title="Email + Password"
      description="Classic credentials—users enter details, Supabase secures the rest while getSession + onAuthStateChange keep the UI live."
      steps={[
        "Toggle between sign up and sign in.",
        "Submit to watch the session card refresh instantly.",
        "Sign out to reset the listener.",
      ]}
    >
      {!currentUser && (
        <form
          className="relative overflow-hidden rounded-[32px] border border-emerald-500/30 bg-gradient-to-br from-[#05130d] via-[#04100c] to-[#0c2a21] p-8 text-slate-100 shadow-[0_35px_90px_rgba(2,6,23,0.65)]"
          onSubmit={handleSubmit}
        >
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Credentials</p>
              <h3 className="text-xl font-semibold text-white">
                {mode === "signup" ? "Create an account" : "Welcome back"}
              </h3>
            </div>

            <div className="flex rounded-full border border-white/10 bg-white/[0.07] p-1 text-xs font-semibold text-slate-300">
              {(["signup", "signin"] as Mode[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => setMode(option)}
                  className={`rounded-full px-4 py-1 transition ${
                    mode === option
                      ? "bg-emerald-500/30 text-white shadow shadow-emerald-500/20"
                      : "text-slate-400"
                  }`}
                >
                  {option === "signup" ? "Sign up" : "Sign in"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-200">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0b1b18] px-3 py-2.5 text-base text-white placeholder-slate-500 shadow-inner shadow-black/30 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                placeholder="you@email.com"
              />
            </label>

            <label className="block text-sm font-medium text-slate-200">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0b1b18] px-3 py-2.5 text-base text-white placeholder-slate-500 shadow-inner shadow-black/30 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                placeholder="At least 6 characters"
              />
            </label>
          </div>

          <button
            type="submit"
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400"
          >
            {mode === "signup" ? "Create account" : "Sign in"}
          </button>

          {status && <p className="mt-4 text-sm text-slate-300">{status}</p>}
        </form>
      )}

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-7 text-slate-200 shadow-[0_25px_70px_rgba(2,6,23,0.65)] backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Session</h3>
            <p className="mt-1 text-sm text-slate-400">
              {currentUser ? "Hydrated by getSession + onAuthStateChange." : "Sign in to hydrate this panel instantly."}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              currentUser ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-slate-400"
            }`}
          >
            {currentUser ? "Active" : "Idle"}
          </span>
        </div>

        {currentUser ? (
          <>
            <dl className="mt-5 space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between gap-6">
                <dt className="text-slate-400">User ID</dt>
                <dd className="font-mono text-xs">{currentUser.id}</dd>
              </div>
              <div className="flex items-center justify-between gap-6">
                <dt className="text-slate-400">Email</dt>
                <dd>{currentUser.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-6">
                <dt className="text-slate-400">Last sign in</dt>
                <dd className="text-xs text-slate-300">
                  {currentUser.last_sign_in_at
                    ? new Date(currentUser.last_sign_in_at).toLocaleString()
                    : "-"}
                </dd>
              </div>
            </dl>

            <button
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-5 text-sm text-slate-400">
            Session metadata will show up here after a successful sign in.
          </div>
        )}
      </section>
    </AuthDemoPage>
  );
}
