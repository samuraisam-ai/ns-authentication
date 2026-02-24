"use client";

import Link from "next/link";
import { useMemo } from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      {children}
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[rgb(190,190,80)]/15 px-3 py-1 text-xs font-semibold text-slate-800 ring-1 ring-[rgb(190,190,80)]/25">
      {children}
    </span>
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
      {/* Sidebar */}
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

      {/* Main */}
      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div>
              <div className="text-xl font-semibold tracking-tight">{title}</div>
              {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Pill>NS</Pill>
              <div className="h-9 w-9 rounded-2xl bg-slate-900 text-white grid place-items-center text-xs font-bold">
                OK
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-4">{children}</main>

        {/* Mobile bottom nav */}
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

export default function WorkspaceClient() {
  // This is just UI scaffolding — no backend logic changed.
  // If you already fetch “next task due” in this page, wire the counts into badges below.
  const counts = useMemo(() => ({ tasksDue: 1, inbox: 1 }), []);

  return (
    <AppShell
      active="workspace"
      tasksBadge={counts.tasksDue || undefined}
      inboxBadge={counts.inbox || undefined}
      title="Workspace"
      subtitle="Chat-first check-ins"
    >
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm text-slate-500">Next up</div>
              <div className="text-lg font-semibold tracking-tight">Daily Check-in</div>
              <div className="mt-1 text-sm text-slate-600">
                <span className="font-medium">Today • 09:00</span>
                <span className="mx-2 text-slate-300">•</span>
                <span className="text-slate-500">daily_checkin</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                href="/tasks"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200 hover:bg-slate-50"
              >
                View tasks
              </Link>
              <Link
                href="/tasks"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Open
              </Link>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-2 text-sm text-slate-500">Workspace chat</div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="space-y-3 text-sm">
              <div className="text-slate-600">
                Ask: <span className="font-medium">“What’s my next task?”</span> or{" "}
                <span className="font-medium">“Show overdue check-ins.”</span>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">You: What do I need to do today?</div>
              <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                Assistant: You have 1 check-in due now. Want to open it?
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
