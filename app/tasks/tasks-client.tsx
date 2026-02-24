"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Task = {
  id: string;
  template_key: string | null;
  template_title: string | null;
  period_key: string | null;
  scheduled_for: string | null;
  status: string | null;
  submitted_at: string | null;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatDT(dt: string | null) {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dt));
  } catch {
    return dt;
  }
}

export default function TasksClient() {
  const pathname = usePathname();

  const [activeTab, setActiveTab] = useState<"incomplete" | "complete">("incomplete");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  async function fetchTasks() {
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Failed to load tasks (${res.status}): ${t}`);
      }
      const data = (await res.json()) as { tasks?: Task[] };
      setTasks(data.tasks ?? []);
    } catch (e: any) {
      setStatus(e?.message ?? "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchTasks();
  }, []);

  const incomplete = tasks.filter((t) => (t.status ?? "").toLowerCase() !== "submitted");
  const complete = tasks.filter((t) => (t.status ?? "").toLowerCase() === "submitted");

  const list = activeTab === "incomplete" ? incomplete : complete;

  const navItems = [
    { href: "/workspace", label: "Workspace" },
    { href: "/tasks", label: "Tasks" },
    { href: "/inbox", label: "Inbox" },
  ];

  return (
    <main className="min-h-screen bg-[var(--ns-surface)] text-[var(--ns-charcoal)]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(199,199,74,0.18),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_35%,rgba(17,24,39,0.08),transparent_45%)]" />
      </div>

      <div className="relative mx-auto min-h-screen w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">
        <header className="flex items-center justify-between rounded-2xl border border-[var(--ns-border)] bg-white/70 px-4 py-3 backdrop-blur">
          <div className="leading-tight">
            <div className="text-sm font-semibold">Tasks</div>
            <div className="text-xs text-slate-500">Complete your check-ins with minimal friction.</div>
          </div>

          <button
            onClick={() => void fetchTasks()}
            className="inline-flex items-center rounded-xl border border-[var(--ns-border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--ns-muted)]"
          >
            Refresh
          </button>
        </header>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-[var(--ns-border)] bg-white/70 p-3 backdrop-blur">
            <div className="px-2 pb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Navigation
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition",
                      active ? "bg-[var(--ns-olive-soft)]" : "text-slate-700 hover:bg-[var(--ns-muted)]"
                    )}
                  >
                    {item.label}
                    {item.href === "/tasks" ? (
                      <span className="rounded-full bg-[var(--ns-charcoal)] px-2 py-0.5 text-xs font-bold text-white">
                        {incomplete.length}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 rounded-xl border border-[var(--ns-border)] bg-white px-3 py-3">
              <div className="text-xs font-semibold text-slate-600">Summary</div>
              <div className="mt-1 text-sm text-slate-700">
                <span className="font-bold">{incomplete.length}</span> incomplete •{" "}
                <span className="font-bold">{complete.length}</span> complete
              </div>
            </div>
          </aside>

          <section className="rounded-2xl border border-[var(--ns-border)] bg-white/70 backdrop-blur">
            <div className="flex items-center justify-between border-b border-[var(--ns-border)] px-4 py-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("incomplete")}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-bold",
                    activeTab === "incomplete"
                      ? "bg-[var(--ns-olive)] text-[var(--ns-charcoal)]"
                      : "bg-white text-slate-700 border border-[var(--ns-border)] hover:bg-[var(--ns-muted)]"
                  )}
                >
                  Incomplete
                </button>
                <button
                  onClick={() => setActiveTab("complete")}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-bold",
                    activeTab === "complete"
                      ? "bg-[var(--ns-olive)] text-[var(--ns-charcoal)]"
                      : "bg-white text-slate-700 border border-[var(--ns-border)] hover:bg-[var(--ns-muted)]"
                  )}
                >
                  Complete
                </button>
              </div>

              <div className="text-xs text-slate-500">
                {activeTab === "incomplete" ? "Tasks requiring attention" : "Submitted tasks"}
              </div>
            </div>

            <div className="px-4 py-4">
              {status ? (
                <div className="mb-3 rounded-xl border border-[var(--ns-border)] bg-white px-3 py-2 text-sm text-slate-700">
                  {status}
                </div>
              ) : null}

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-2xl border border-[var(--ns-border)] bg-white" />
                  ))}
                </div>
              ) : list.length === 0 ? (
                <div className="rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-4 text-sm text-slate-700">
                  {activeTab === "incomplete" ? "No tasks pending." : "No completed tasks yet."}
                </div>
              ) : (
                <div className="space-y-3">
                  {list.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {t.template_title ?? "Check-in"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {t.template_key ? <span className="mr-2">{t.template_key}</span> : null}
                            {t.period_key ? <span className="mr-2">• {t.period_key}</span> : null}
                            {t.scheduled_for ? <span>• {formatDT(t.scheduled_for)}</span> : null}
                          </div>
                        </div>

                        {activeTab === "incomplete" ? (
                          <Link
                            href={`/checkins/task/${t.id}`}
                            className="inline-flex items-center rounded-xl bg-[var(--ns-charcoal)] px-4 py-2 text-sm font-bold text-white hover:opacity-95"
                          >
                            Open
                          </Link>
                        ) : (
                          <div className="text-xs text-slate-500">
                            Submitted{t.submitted_at ? ` • ${formatDT(t.submitted_at)}` : ""}
                          </div>
                        )}
                      </div>

                      {activeTab === "complete" && t.submitted_at ? (
                        <div className="mt-3 rounded-xl bg-[var(--ns-muted)] px-3 py-2 text-xs text-slate-700">
                          Submitted at <span className="font-semibold">{formatDT(t.submitted_at)}</span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
