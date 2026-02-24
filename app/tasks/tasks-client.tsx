"use client";

import { useEffect, useState } from "react";
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

export default function TasksClient() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch tasks");
      }
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }

  const pendingTasks = tasks.filter(
    (task) => task.status === "pending" || task.status === "overdue"
  );
  const completedTasks = tasks.filter((task) => task.status === "submitted");

  const displayTasks = activeTab === "pending" ? pendingTasks : completedTasks;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-slate-900/10 pb-4">
        <Link href="/workspace" className="text-sm font-medium text-slate-500 hover:text-slate-800">
          ← Back to Workspace
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
        <div className="w-32" /> {/* Spacer for alignment */}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 rounded-xl border border-slate-900/10 bg-slate-50 p-1">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "pending"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Pending
          {pendingTasks.length > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
              {pendingTasks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "completed"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Completed
          {completedTasks.length > 0 && (
            <span className="ml-2 text-xs text-slate-500">({completedTasks.length})</span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-slate-900/10 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">Loading tasks...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : displayTasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-900/10 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            {activeTab === "pending" ? "No pending tasks" : "No completed tasks"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => router.push(`/checkins/task/${task.id}`)}
              className="w-full rounded-xl border border-slate-900/10 bg-white p-5 text-left transition hover:bg-slate-50 hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-900">
                    {task.template_title || task.template_key}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <span className="text-slate-500">Status:</span>
                      <span
                        className={`font-medium ${
                          task.status === "overdue"
                            ? "text-red-600"
                            : task.status === "pending"
                            ? "text-yellow-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {task.status}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-slate-500">Scheduled:</span>
                      <span className="font-medium">
                        {new Date(task.scheduled_for).toLocaleDateString()}
                      </span>
                    </span>
                    {task.submitted_at && (
                      <span className="flex items-center gap-1">
                        <span className="text-slate-500">Submitted:</span>
                        <span className="font-medium">
                          {new Date(task.submitted_at).toLocaleDateString()}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-4 flex items-center text-slate-400">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
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
