"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Task {
  id: string;
  status: string;
  scheduled_for: string;
  sent_at?: string;
  submitted_at?: string;
  template_key: string;
  template_title: string;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "overdue" ? "danger" : status === "pending" ? "warn" : "ok";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1",
        tone === "danger" && "bg-red-50 text-red-700 ring-red-200",
        tone === "warn" && "bg-[#B8BE3B]/15 text-slate-900 ring-[#B8BE3B]/35",
        tone === "ok" && "bg-emerald-50 text-emerald-700 ring-emerald-200"
      )}
    >
      {status}
    </span>
  );
}

export default function TasksClient() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchTasks() {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).error || "Failed to fetch tasks");
      }
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }

  const pendingTasks = useMemo(
    () => tasks.filter((t) => t.status === "pending" || t.status === "overdue"),
    [tasks]
  );

  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === "submitted"),
    [tasks]
  );

  const displayTasks = activeTab === "pending" ? pendingTasks : completedTasks;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-900/10 pb-4">
        <Link href="/workspace" className="text-sm font-medium text-slate-500 hover:text-slate-800">
          ← Back to Workspace
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
        <div className="w-32" />
      </div>

      {/* Notice bar (more noticeable nudges, not loud) */}
      {pendingTasks.length > 0 ? (
        <div className="mb-4 rounded-2xl bg-slate-900 px-4 py-3 text-white ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-semibold">Attention:</span> You have{" "}
              <span className="font-semibold text-[#B8BE3B]">{pendingTasks.length}</span>{" "}
              task(s) to complete.
            </div>
            <span className="hidden sm:inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
              Keep it quick and clean
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="text-sm text-slate-700">
            You’re up to date. Completed submissions live in the <span className="font-semibold">Complete</span> tab.
          </div>
        </div>
      )}

      {/* Tabs (keep existing structure) */}
      <div className="mb-6 flex gap-2 rounded-2xl border border-slate-900/10 bg-slate-50 p-1">
        <button
          onClick={() => setActiveTab("pending")}
          className={cx(
            "flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition",
            activeTab === "pending"
              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          Incomplete
          {pendingTasks.length > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#B8BE3B] px-1.5 text-xs font-bold text-slate-900">
              {pendingTasks.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("completed")}
          className={cx(
            "flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition",
            activeTab === "completed"
              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          Complete
          {completedTasks.length > 0 && (
            <span className="ml-2 text-xs text-slate-500">({completedTasks.length})</span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-slate-900/10 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">Loading tasks…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : displayTasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-900/10 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            {activeTab === "pending" ? "No incomplete tasks" : "No completed tasks"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => router.push(`/checkins/task/${task.id}`)}
              className="w-full rounded-2xl border border-slate-900/10 bg-white p-5 text-left transition hover:bg-slate-50 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900 line-clamp-1">
                    {task.template_title || task.template_key}
                  </h3>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusPill status={task.status} />
                    <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      Scheduled: {formatDateTime(task.scheduled_for)}
                    </span>
                    {task.submitted_at ? (
                      <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                        Submitted: {formatDateTime(task.submitted_at)}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Template key: <span className="font-semibold text-slate-700">{task.template_key}</span>
                  </div>
                </div>

                <div className="shrink-0 text-slate-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
