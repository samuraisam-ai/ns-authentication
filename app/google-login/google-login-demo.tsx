"use client";

import { AuthDemoPage } from "@/app/components/auth-demo-page";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

type GoogleLoginDemoProps = { user: User | null };

export default function GoogleLoginDemo({ user }: GoogleLoginDemoProps) {
  const [status, setStatus] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(user);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/google-login`,
      },
    });

    setStatus(error ? error.message : "Redirecting to Google...");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setStatus("Signed out successfully");
  }

  return (
    <AuthDemoPage
      title="Google Login"
      description="OAuth login with Supabase and a live session listener to keep the UI synced."
      steps={[
        "Start the OAuth redirect with Google.",
        "Return to see the session panel hydrate.",
        "Sign out to reset the listener.",
      ]}
    >
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-7 text-slate-200 shadow-[0_25px_70px_rgba(2,6,23,0.65)] backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">OAuth</h3>
            <p className="mt-1 text-sm text-slate-400">
              {currentUser ? "Signed in via Google." : "Use Google to sign in."}
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
            </dl>

            <button
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
            onClick={handleGoogleLogin}
          >
            Continue with Google
          </button>
        )}

        {status && <p className="mt-4 text-sm text-slate-300">{status}</p>}
      </section>
    </AuthDemoPage>
  );
}
