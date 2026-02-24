"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NotificationItem = {
  id: string;
  title?: string | null;
  message?: string | null;
  created_at?: string | null;
  task_id?: string | null;
  read_at?: string | null;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatDT(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dt));
  } catch {
    return String(dt);
  }
}

export default function InboxClient() {
  const pathname = usePathname();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  async function fetchNotifications() {
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Failed to load inbox (${res.status}): ${t}`);
      }
      const data = (await res.json()) as { notifications?: NotificationItem[] };
      setItems(data.notifications ?? []);
    } catch (e: any) {
      setStatus(e?.message ?? "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchNotifications();
  }, []);

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
            <div className="text-sm font-semibold">Inbox</div>
            <div className="text-xs text-slate-500">Attention items. Click through to tasks.</div>
          </div>

          <button
            onClick={() => void fetchNotifications()}
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
                  </Link>
                );
              })}
            </nav>
          </aside>

          <section className="rounded-2xl border border-[var(--ns-border)] bg-white/70 backdrop-blur">
            <div className="border-b border-[var(--ns-border)] px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Notifications
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
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-2xl border border-[var(--ns-border)] bg-white" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-4 text-sm text-slate-700">
                  No notifications right now.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((n) => (
                    <div key={n.id} className="rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {n.title ?? "Notification"}
                          </div>
                          <div className="mt-1 text-sm text-slate-700">{n.message ?? ""}</div>
                          <div className="mt-2 text-xs text-slate-500">{formatDT(n.created_at)}</div>
                        </div>

                        {n.task_id ? (
                          <Link
                            href={`/checkins/task/${n.task_id}`}
                            className="inline-flex items-center rounded-xl bg-[var(--ns-charcoal)] px-4 py-2 text-sm font-bold text-white hover:opacity-95"
                          >
                            Open task
                          </Link>
                        ) : null}
                      </div>
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
