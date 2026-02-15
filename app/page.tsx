import Link from "next/link";

const logoUrl =
  "https://res.cloudinary.com/dtjysgyny/image/upload/v1771108693/Untitled_design-5_fbkcop.png";

const flows = [
  {
    href: "/google-login",
    title: "Google Login",
    description:
      "Social login via signInWithOAuth with automatic UI sync powered by onAuthStateChange.",
    highlights: ["Redirect URLs", "Call signInWithOAuth", "Watch session update"],
    accent: "blue" as const,
  },
  {
    href: "/email-password",
    title: "Email + Password",
    description:
      "Classic credentials flow with Supabase-managed sessions and a React listener that never goes stale.",
    highlights: ["Toggle sign in/sign up", "Show the session panel", "Explain password rules"],
    accent: "green" as const,
  },
] as const;

function FlowCard({
  href,
  title,
  description,
  highlights,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  highlights: readonly string[];
  accent: "green" | "blue";
}) {
  const ring =
    accent === "green" ? "ring-emerald-500/15 hover:ring-emerald-500/25" : "ring-slate-900/10 hover:ring-slate-900/15";
  const bar = accent === "green" ? "bg-emerald-500" : "bg-slate-900";
  const chip =
    accent === "green"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
      : "border-slate-900/20 bg-slate-900/5 text-slate-700";

  return (
    <Link
      href={href}
      className={`group block rounded-3xl bg-white p-6 shadow-[0_18px_55px_rgba(2,6,23,0.08)] ring-1 ${ring} transition hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Flow
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
            {title}
          </h3>
        </div>

        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${chip}`}>
          Open <span aria-hidden="true">↗</span>
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>

      <div className="mt-5 flex items-center gap-3">
        <span className={`h-1.5 w-1.5 rounded-full ${bar}`} />
        <p className="text-xs font-semibold text-slate-500">What you’ll test</p>
      </div>

      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {highlights.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/70" />
            <span className="leading-snug">{h}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Route: <span className="font-mono text-slate-700">{href}</span>
        </p>
        <span className="text-xs font-semibold text-slate-400 transition group-hover:text-slate-600">
          Launch
        </span>
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* subtle futuristic background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.16),transparent_35%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_35%,rgba(2,6,23,0.08),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.02),transparent_30%,rgba(2,6,23,0.02))]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          {/* LEFT: tall welcome card */}
          <section className="rounded-[32px] bg-white p-8 shadow-[0_22px_70px_rgba(2,6,23,0.10)] ring-1 ring-slate-900/10">
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="Logo" className="h-11 w-11 rounded-xl object-contain" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Internal Auth Console
                </p>
                <p className="text-sm font-semibold text-slate-900">Supabase × Next.js</p>
              </div>
            </div>

            <h1 className="mt-7 text-4xl font-semibold tracking-tight">
              Welcome.
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              This workspace contains two production-ready authentication flows.
              Routes and session wiring are already connected — you can safely iterate on UI.
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-900/10 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Guardrails
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Keep auth logic isolated.
                  Change UI freely.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  Accent
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  White base.
                  Green highlights.
                </p>
              </div>
            </div>

            <div className="mt-7 rounded-2xl border border-slate-900/10 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Quick start</p>
              <ol className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Open a flow on the right.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Edit UI components only (routes stay stable).
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Run the smoke test after each change.
                </li>
              </ol>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-900/10 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Minimal
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-900/10 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Sleek
              </span>
              <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Futuristic
              </span>
            </div>
          </section>

          {/* RIGHT: two stacked cards (center-right) */}
          <section className="flex w-full justify-center lg:justify-end">
            <div className="w-full max-w-md space-y-6">
              <FlowCard {...flows[0]} />
              <FlowCard {...flows[1]} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
