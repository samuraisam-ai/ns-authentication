"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { MENU_BUBBLE_BUTTON, MENU_EXPANDABLE_BUTTON } from "@/lib/menu-styles";
import AppMenu from "@/app/components/AppMenu";

interface Task {
  id: string;
  status: string;
  scheduled_for: string;
  sent_at?: string;
  submitted_at?: string;
  template_key: string;
  template_title: string;
}

type Session = {
  id: string;
  title: string;
  updated_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

const TASK_DESCRIPTIONS: Record<string, string> = {
  daily_checkin: "Set today’s priorities",
  daily_checkout: "Review results + status.",
  weekly_checkin: "Reflect + plan improvements.",
};

export default function TasksClient() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [nextTaskLoading, setNextTaskLoading] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadSessions();
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

  async function handleStartNextTask() {
    try {
      setNextTaskLoading(true);
      const res = await fetch("/api/tasks/next");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch next task");
      }
      const data = await res.json();
      if (!data.task) {
        alert("No more tasks for today.");
        return;
      }
      router.push(`/checkins/task/${data.task.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setNextTaskLoading(false);
    }
  }

  const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "overdue");
  const completedTasks = tasks.filter((t) => t.status === "submitted");
  const displayTasks = activeTab === "pending" ? pendingTasks : completedTasks;

  async function loadSessions() {
    try {
      const res = await fetch("/api/chat/sessions");
      if (!res.ok) return;
      const data = (await res.json()) as { sessions?: Session[] };
      setSessions(data.sessions ?? []);
    } catch {
      setSessions([]);
    }
  }

  async function loadHistory(sessionId: string) {
    try {
      const res = await fetch(`/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: Message[] };
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function formatMockTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--:--";

    const hours24 = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const meridiem = hours24 >= 12 ? "PM" : "AM";

    return `${hours24}:${minutes} ${meridiem}`;
  }

  const SidebarContent = (
    <aside className="fixed inset-0 z-50 flex h-full flex-col bg-white">
      <AppMenu onClose={() => setMenuOpen(false)} />

      <div className="sticky bottom-0 mt-auto border-t border-slate-900/10 bg-white px-4 py-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <img
            src="https://res.cloudinary.com/dtjysgyny/image/upload/v1772030126/logout_icon_transparent_leznaq.png"
            alt=""
            aria-hidden="true"
            className="h-7 w-7 object-contain"
          />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <main className="min-h-screen bg-[#eaeaea] text-slate-900" suppressHydrationWarning>
      {!mounted ? null : (
        <>
          <header className="sticky top-0 z-20 w-full border-b border-black/10 bg-white px-5 py-4 md:px-10">
            <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button type="button" onClick={() => router.push("/tasks")} aria-label="Go to tasks">
                    <img
                      src="https://res.cloudinary.com/dtjysgyny/image/upload/v1771966266/NS_Logos-01_1_2_snskdp.png"
                      alt="NS logo"
                      className="h-9 w-9 object-contain"
                    />
                  </button>
                  {pendingTasks.length > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                      {pendingTasks.length > 99 ? "99+" : pendingTasks.length}
                    </span>
                  ) : null}
                </div>

                <p className="text-lg text-slate-900">
                  <span className="font-semibold">NS</span>{" "}
                  <span className="font-medium">Coach</span>
                </p>
              </div>

              <button type="button" onClick={() => setMenuOpen(true)} className="inline-flex items-center justify-center" aria-label="Open menu">
                <span className="flex flex-col gap-1">
                  <span className="block h-[2px] w-6 bg-[#d8cd72]" />
                  <span className="block h-[2px] w-6 bg-[#d8cd72]" />
                  <span className="block h-[2px] w-6 bg-[#d8cd72]" />
                </span>
              </button>
            </div>
          </header>

          {menuOpen ? SidebarContent : null}

          <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-7 pb-8 pt-4 md:px-10 md:pt-6">
            <section className="flex-1">
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <h1 className="text-left text-2xl font-semibold">My Tasks</h1>
                <button
                  onClick={handleStartNextTask}
                  disabled={nextTaskLoading}
                  className="rounded-lg bg-[#cccd33] px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-[#b8b92e] disabled:opacity-50 transition-colors"
                >
                  {nextTaskLoading ? "Finding..." : "Start Next Task"}
                </button>
              </div>
            </div>

            <div className="mb-5">
              <div className="relative">
                <div className="grid grid-cols-2">
                  <button
                    onClick={() => setActiveTab("pending")}
                    className={cx(
                      "flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                      activeTab === "pending" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <span>Incomplete</span>
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-[11px] font-semibold text-slate-700">
                      {pendingTasks.length > 99 ? "99+" : pendingTasks.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab("completed")}
                    className={cx(
                      "flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                      activeTab === "completed" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <span>Complete</span>
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-[11px] font-semibold text-slate-700">
                      {completedTasks.length > 99 ? "99+" : completedTasks.length}
                    </span>
                  </button>
                </div>

                <div className="absolute bottom-0 left-0 h-px w-full bg-black/70" />
                <div
                  className={cx(
                    "absolute bottom-0 h-1 w-1/2 bg-[#cccd33] transition-all duration-300",
                    activeTab === "pending" ? "left-0" : "left-1/2"
                  )}
                />
              </div>
            </div>

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
              <div className="space-y-6">
                {displayTasks.map((task) => {
                  const description = TASK_DESCRIPTIONS[task.template_key] ?? "";
                  const displayTitle = task.template_key === "weekly_checkin" ? "Weekly Check-out" : task.template_title || task.template_key;

                  return (
                    <button
                      key={task.id}
                      onClick={() => router.push(`/checkins/task/${task.id}`)}
                      className="relative w-full rounded-lg bg-white text-left shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/40 transition-shadow"
                    >
                      <div className="min-w-0 flex-1">
                          <div className="absolute left-[-6px] top-0 h-10 w-3 rounded-full bg-[#cccd33]" />
                          <div className="flex h-10 items-center">
                            <div className="min-w-0 flex h-full flex-1 items-center rounded-tl-lg bg-[#cccd33]/25 px-4 pl-3">
                              <h3 className="truncate text-[18px] font-bold text-black">{displayTitle}</h3>
                            </div>
                            <div className="flex h-full items-center gap-2 rounded-tr-lg bg-[#545454] px-4 text-white">
                              <span className="text-[16px] font-semibold">{formatMockTime(task.scheduled_for)}</span>
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="9" strokeWidth="2" />
                                <path d="M12 7v5l3 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          </div>

                          <div className="min-h-[64px] rounded-b-lg bg-white px-4 py-4">
                            <p className="text-[16px] text-[#8f8f8f]">{description}</p>
                          </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
