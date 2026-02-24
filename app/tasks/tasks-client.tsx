"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface Task {
  id: string;
  status: string;
  scheduled_for: string;
  sent_at?: string;
  submitted_at?: string;
  template_key: string;
  template_title: string;
}

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-900/10 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {children}
    </span>
  );
}

export default function TasksClient() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");

  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpenDesktop, setSidebarOpenDesktop] = useState(true);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchTasks() {
    try {
      setLoading(true);
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch tasks");
      }
      const data = await res.json();
      setTasks(data.tasks || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }

  const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "overdue");
  const completedTasks = tasks.filter((t) => t.status === "submitted");
  const displayTasks = activeTab === "pending" ? pendingTasks : completedTasks;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const Sidebar = (
    <aside className={cx("flex h-full flex-col border-r border-slate-900/10 bg-white", sidebarOpenDesktop ? "w-80" : "w-20")}>
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="h-10 w-10 rounded-2xl bg-[#c7c85a]/30" />
        {sidebarOpenDesktop ? (
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">NetworkSpace</p>
            <p className="text-xs text-slate-500">AI Check-Ins</p>
          </div>
        ) : null}

        <button
          onClick={() => setSidebarOpenDesktop((v) => !v)}
          className={cx(
            "ml-auto rounded-xl border border-slate-900/10 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50",
            !sidebarOpenDesktop && "ml-0"
          )}
          aria-label="Toggle sidebar"
        >
          {sidebarOpenDesktop ? "⟨" : "⟩"}
        </button>
      </div>

      <nav className="px-3">
        {sidebarOpenDesktop ? (
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Menu</p>
        ) : null}

        <div className="space-y-1">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/workspace");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="h-2 w-2 rounded-full bg-slate-200" />
            {sidebarOpenDesktop ? <span>Workspace</span> : null}
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/tasks");
            }}
            className="flex w-full items-center gap-3 rounded-xl bg-[#c7c85a]/20 px-3 py-2.5 text-sm font-medium text-slate-900"
          >
            <span className="h-2 w-2 rounded-full bg-[#c7c85a]" />
            {sidebarOpenDesktop ? <span>Tasks</span> : null}
            {sidebarOpenDesktop && pendingTasks.length > 0 ? (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c7c85a] px-1.5 text-[11px] font-semibold text-[#0f172a]">
                {pendingTasks.length > 99 ? "99+" : pendingTasks.length}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/inbox");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="h-2 w-2 rounded-full bg-slate-200" />
            {sidebarOpenDesktop ? <span>Inbox</span> : null}
          </button>
        </div>
      </nav>

      <div className="mt-auto border-t border-slate-900/10 px-5 py-4">
        <button
          onClick={handleSignOut}
          className="w-full rounded-2xl border border-slate-900/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <main className="min-h-screen bg-white text-slate-900" suppressHydrationWarning>
      {!mounted ? null : (
        <>
          <div className="pointer-events-none fixed inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(199,200,90,0.18),transparent_45%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(15,23,42,0.06),transparent_55%)]" />
          </div>

          <div className="relative flex min-h-screen">
            <div className="hidden md:block">{Sidebar}</div>

            {/* Mobile top bar */}
            <div className="md:hidden fixed left-0 right-0 top-0 z-20 border-b border-slate-900/10 bg-white/90 backdrop-blur">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Menu
                </button>
                <div className="text-sm font-semibold text-slate-900">Tasks</div>
                <button
                  onClick={() => router.push("/workspace")}
                  className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Workspace
                </button>
              </div>
            </div>

            {/* Mobile drawer */}
            {mobileMenuOpen ? (
              <div className="md:hidden fixed inset-0 z-30">
                <div className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
                <div className="absolute inset-y-0 left-0">
                  <div className="h-full w-80">{Sidebar}</div>
                </div>
              </div>
            ) : null}

            {/* Content */}
            <section className="flex-1 px-5 pb-8 pt-20 md:px-10 md:pt-8">
              <div className="mx-auto w-full max-w-4xl">
                <div className="mb-6 hidden md:flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-semibold">Tasks</h1>
                    <p className="mt-1 text-sm text-slate-500">Only what you need to do. Clean. Fast.</p>
                  </div>

                  <button
                    onClick={fetchTasks}
                    className="rounded-2xl border border-slate-900/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Refresh
                  </button>
                </div>

                {/* Tabs */}
                <div className="mb-5 flex gap-2 rounded-2xl border border-slate-900/10 bg-slate-50 p-1">
                  <button
                    onClick={() => setActiveTab("pending")}
                    className={cx(
                      "flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
                      activeTab === "pending" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Pending
                    {pendingTasks.length > 0 ? (
                      <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c7c85a] px-1.5 text-[11px] font-semibold text-[#0f172a]">
                        {pendingTasks.length > 99 ? "99+" : pendingTasks.length}
                      </span>
                    ) : null}
                  </button>

                  <button
                    onClick={() => setActiveTab("completed")}
                    className={cx(
                      "flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
                      activeTab === "completed" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Completed
                    {completedTasks.length > 0 ? <span className="ml-2 text-xs text-slate-500">({completedTasks.length})</span> : null}
                  </button>
                </div>

                {/* Body */}
                {loading ? (
                  <div className="rounded-3xl border border-slate-900/10 bg-white p-8 text-center">
                    <p className="text-sm text-slate-600">Loading tasks…</p>
                  </div>
                ) : error ? (
                  <div className="rounded-3xl border border-red-300 bg-red-50 p-6">
                    <p className="text-sm font-semibold text-red-800">Could not load tasks</p>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                  </div>
                ) : displayTasks.length === 0 ? (
                  <div className="rounded-3xl border border-slate-900/10 bg-slate-50 p-8 text-center">
                    <p className="text-sm text-slate-600">{activeTab === "pending" ? "No pending tasks." : "No completed tasks yet."}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayTasks.map((task) => {
                      const statusTone =
                        task.status === "overdue" ? "text-red-700" : task.status === "pending" ? "text-amber-700" : "text-emerald-700";

                      return (
                        <button
                          key={task.id}
                          onClick={() => router.push(`/checkins/task/${task.id}`)}
                          className="w-full rounded-3xl border border-slate-900/10 bg-white p-5 text-left transition hover:bg-slate-50 hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-semibold text-slate-900">{task.template_title || task.template_key}</h3>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <Pill>
                                  <span className="text-slate-500">Status:</span>&nbsp;
                                  <span className={cx("font-semibold", statusTone)}>{task.status}</span>
                                </Pill>

                                <Pill>
                                  <span className="text-slate-500">Scheduled:</span>&nbsp;
                                  <span className="font-semibold">{new Date(task.scheduled_for).toLocaleString()}</span>
                                </Pill>

                                {task.submitted_at ? (
                                  <Pill>
                                    <span className="text-slate-500">Submitted:</span>&nbsp;
                                    <span className="font-semibold">{new Date(task.submitted_at).toLocaleString()}</span>
                                  </Pill>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-1 text-slate-400">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
