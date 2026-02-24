"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TaskItem = {
  id: number;
  template_key: string | null;
  template_title: string | null;
  scheduled_for: string | null;
  status: string | null;
  submitted_at?: string | null;
};

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

export default function TasksClient() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"incomplete" | "complete">("incomplete");
  const [items, setItems] = useState<TaskItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fetchTasks() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/tasks/api/list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load tasks");
      setItems(data?.tasks ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  const incomplete = useMemo(
    () => items.filter((t) => (t.status ?? "").toLowerCase() !== "submitted"),
    [items]
  );
  const complete = useMemo(
    () => items.filter((t) => (t.status ?? "").toLowerCase() === "submitted"),
    [items]
  );

  const list = tab === "incomplete" ? incomplete : complete;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)] p-1">
          <button
            className={[
              "rounded-2xl px-4 py-2 text-sm font-medium",
              tab === "incomplete"
                ? "bg-white border border-[var(--ns-border)]"
                : "text-black/60 hover:text-black",
            ].join(" ")}
            onClick={() => setTab("incomplete")}
          >
            Incomplete <span className="ml-1 text-xs text-black/50">({incomplete.length})</span>
          </button>
          <button
            className={[
              "rounded-2xl px-4 py-2 text-sm font-medium",
              tab === "complete"
                ? "bg-white border border-[var(--ns-border)]"
                : "text-black/60 hover:text-black",
            ].join(" ")}
            onClick={() => setTab("complete")}
          >
            Complete <span className="ml-1 text-xs text-black/50">({complete.length})</span>
          </button>
        </div>

        <button
          onClick={fetchTasks}
          className="rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-2 text-sm font-medium hover:bg-black/5"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-16 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)]" />
            <div className="h-16 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)]" />
            <div className="h-16 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)]" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)] p-4">
            <div className="text-sm font-semibold">Couldn’t load tasks</div>
            <div className="mt-1 text-sm text-black/60">{error}</div>
            <button
              onClick={fetchTasks}
              className="mt-3 rounded-2xl bg-[var(--ns-charcoal)] px-4 py-2 text-sm font-medium text-white"
            >
              Try again
            </button>
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)] p-6 text-center">
            <div className="text-sm font-semibold">
              {tab === "incomplete" ? "You’re all caught up." : "No completed tasks yet."}
            </div>
            <div className="mt-1 text-sm text-black/60">
              Keep it consistent. Small wins stack.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((t) => {
              const title = t.template_title ?? t.template_key ?? "Check-in";
              const when = formatDateTime(t.scheduled_for);
              const submitted = t.submitted_at ? formatDateTime(t.submitted_at) : null;

              return (
                <Link
                  key={t.id}
                  href={`/checkins/task/${t.id}`}
                  className="block rounded-2xl border border-[var(--ns-border)] bg-white p-4 hover:bg-black/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">{title}</div>
                      <div className="mt-1 text-xs text-black/55">
                        Scheduled: {when}
                        {submitted ? <> • Submitted: {submitted}</> : null}
                      </div>
                    </div>

                    <div className="shrink-0 rounded-full bg-[var(--ns-olive)]/20 px-3 py-1 text-xs font-medium">
                      {tab === "complete" ? "Submitted" : "Pending"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
