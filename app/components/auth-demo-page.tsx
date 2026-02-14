"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AuthDemoPageProps = {
  title: string;
  intro: string;
  steps: string[];
  children: ReactNode;
};

export function AuthDemoPage({ title, intro, steps, children }: AuthDemoPageProps) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <Link href="/" className="text-sm text-white/70 hover:text-white">
          ← Back to Home
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm text-white/70">{intro}</p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-white/70">
              {steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>

          {/* THIS is the critical part */}
          <div className="flex flex-col gap-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
