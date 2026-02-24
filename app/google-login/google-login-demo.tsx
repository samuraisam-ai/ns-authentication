"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function GoogleLoginDemo() {
  const supabase = getSupabaseBrowserClient();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setStatus("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/workspace` },
      });
      if (error) throw error;
    } catch (e: any) {
      setStatus(e?.message ?? "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ns-surface)] text-[var(--ns-charcoal)]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(199,199,74,0.18),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_35%,rgba(17,24,39,0.08),transparent_45%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
        <div className="rounded-3xl border border-[var(--ns-border)] bg-white/75 p-6 backdrop-blur">
          <div className="text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-[var(--ns-olive)]" />
            <h1 className="text-xl font-extrabold">NetworkSpace</h1>
            <p className="mt-1 text-sm text-slate-600">Sign in with Google.</p>
          </div>

          {status ? (
            <div className="mt-4 rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-3 text-sm text-slate-700">
              {status}
            </div>
          ) : null}

          <div className="mt-5">
            <button
              onClick={() => void signInWithGoogle()}
              disabled={loading}
              className={cn(
                "w-full rounded-2xl px-4 py-3 text-sm font-extrabold",
                loading ? "bg-slate-200 text-slate-500" : "bg-[var(--ns-charcoal)] text-white hover:opacity-95"
              )}
            >
              {loading ? "Redirecting…" : "Continue with Google"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
