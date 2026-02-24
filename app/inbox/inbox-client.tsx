"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Task = {
  id: string | number;
  template_title?: string | null;
  template_key?: string | null;
  scheduled_for?: string | null;
  status?: string | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDisplayDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(d);
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      {children}
    </section>
  );
}

function SidebarItem({
  href,
  label,
  active,
  badge,
}: {
  href: string;
  label: string;
  active?: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-[rgb(190,190,80)]/15 text-slate-900 ring-1 ring-[rgb(190,190,80)]/25"
          : "text-slate-700 hover:bg-slate-100"
      )}
    >
      <span>{label}</span>
      {badge ? (
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">{badge}</span>
      ) : null}
    </Link>
  );
}

function AppShell({
  active,
  tasksBadge,
  inboxBadge,
  title,
  subtitle,
  children,
}: {
  active: "workspace" | "tasks" | "inbox";
  tasksBadge?: number;
  inboxBadge?: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white/70 backdrop-blur md:block">
        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[rgb(190,190,80)]/25 ring-1 ring-[rgb(190,190,80)]/40" />
            <div>
              <div className="text-sm font-semibold tracking-tight">NetworkSpace</div>
              <div className="text-xs text-slate-500">AI Check-ins</div>
            </div>
          </div>
        </div>

        <nav className="px-3 space-y-1">
          <SidebarItem href="/workspace" label="Workspace" active={active === "workspace"} />
          <SidebarItem href="/tasks" label="Tasks" active={active === "tasks"} badge={tasksBadge} />
          <SidebarItem href="/inbox" label="Inbox" active={active === "inbox"} badge={inboxBadge} />
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div>
              <div className="text-xl font-semibold tracking-tight">{title}</div>
              {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
            </div>
            <div className="h-9 w-9 rounded-2xl bg-slate-900 text-white grid place-items-center text-xs font-bold">
              OK
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-4">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/85 backdrop-blur md:hidden">
          <div className="mx-auto grid max-w-5xl grid-cols-3 gap-2 px-4 py-2">
            <Link
              href="/workspace"
              className={cn(
                "rounded-2xl px-3 py-2 text-center text-sm font-semibold",
                active === "workspace" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
              )}
            >
              Workspace
            </Link>
            <Link
              href="/tasks"
              className={cn(
                "rounded-2xl px-3 py-2 text-center text-sm font-semibold",
                active === "tasks" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
              )}
            >
              Tasks
            </Link>
            <Link
              href="/inbox"
              className={cn(
                "rounded-2xl px-3 py-2 text-center text-sm font-semibold",
                active === "inbox" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
              )}
            >
              Inbox
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}

export default function InboxClient() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/tasks", { cache: "no-store" });
        const data = await res.json();
        const list: Task[] = Array.isArray(data) ? data : data?.tasks ?? [];
        if (!ignore) setTasks(list);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  const due = useMemo(
    () => tasks.filter((t) => (t.status ?? "").toLowerCase() === "due"),
    [tasks]
  );

  const dueCount = due.length;

  return (
    <AppShell
      active="inbox"
      tasksBadge={dueCount || undefined}
      inboxBadge={dueCount || undefined}
      title="Inbox"
      subtitle="Attention items that link to tasks"
    >
      {loading ? (
        <Card>
          <div className="text-sm text-slate-600">Loading…</div>
        </Card>
      ) : due.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-600">No attention items right now.</div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {due.map((t) => {
            const title = t.template_title ?? "Task due";
            const templateKey = t.template_key ?? "unknown_template";
            const scheduled = t.scheduled_for ? formatDisplayDate(t.scheduled_for) : "—";

            return (
              <Card key={String(t.id)} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold tracking-tight">Task due</div>
                  <div className="mt-1 text-base font-semibold">{title}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    <span className="font-medium">{scheduled}</span>
                    <span className="mx-2 text-slate-300">•</span>
                    <span className="text-slate-500">{templateKey}</span>
                  </div>
                </div>

                <Link
                  href={`/checkins/task/${t.id}`}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Open
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
