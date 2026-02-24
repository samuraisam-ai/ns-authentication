"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type InboxItem = {
  id: number;
  title: string;
  message: string;
  task_id?: number | null;
  created_at?: string | null;
  is_read?: boolean | null;
};

function formatTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

export default function InboxClient() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // If you already have an inbox API route, keep it.
      // If not, this will show the error state until you wire it.
      const res = await fetch("/inbox/api/list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load inbox");
      setItems(data?.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Inbox</div>
          <div className="mt-1 text-xs text-black/55">
            Only items that require attention. Tap to open the relevant task.
          </div>
        </div>
        <button
          onClick={load}
          className="rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-2 text-sm font-medium hover:bg-black/5"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-20 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)]" />
            <div className="h-20 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)]" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)] p-4">
            <div className="text-sm font-semibold">Couldn’t load inbox</div>
            <div className="mt-1 text-sm text-black/60">{error}</div>
            <div className="mt-3 text-xs text-black/50">
              If you don’t have an inbox API yet, that’s fine — we can wire it later.
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)] p-6 text-center">
            <div className="text-sm font-semibold">You’re all caught up.</div>
            <div className="mt-1 text-sm text-black/60">
              No attention items right now.
            </div>
            <Link
              href="/tasks"
              className="mt-4 inline-flex rounded-2xl bg-[var(--ns-charcoal)] px-4 py-2 text-sm font-medium text-white"
            >
              Go to Tasks
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => {
              const href = n.task_id ? `/checkins/task/${n.task_id}` : "/tasks";
              return (
                <Link
                  key={n.id}
                  href={href}
                  className="block rounded-2xl border border-[var(--ns-border)] bg-white p-4 hover:bg-black/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">{n.title}</div>
                      <div className="mt-1 text-sm text-black/70">{n.message}</div>
                      <div className="mt-2 text-xs text-black/50">
                        {formatTime(n.created_at)}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full bg-[var(--ns-olive)]/20 px-3 py-1 text-xs font-medium">
                      View
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
