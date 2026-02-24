"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TaskDetail = {
  id: string | number;
  user_id?: string | null;
  template_key?: string | null;
  template_title?: string | null;
  scheduled_for?: string | null;
  status?: string | null;
  // template can arrive joined/normalized depending on your API
  template?: any;
};

type FieldAnswer = string;

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
  title,
  subtitle,
  children,
}: {
  active: "workspace" | "tasks" | "inbox";
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
          <SidebarItem href="/tasks" label="Tasks" active={active === "tasks"} />
          <SidebarItem href="/inbox" label="Inbox" active={active === "inbox"} />
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

        <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/85 backdrop-blur md:hidden">
          <div className="mx-auto grid max-w-5xl grid-cols-3 gap-2 px-4 py-2">
            <Link
              href="/workspace"
              className="rounded-2xl px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Workspace
            </Link>
            <Link
              href="/tasks"
              className="rounded-2xl px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Tasks
            </Link>
            <Link
              href="/inbox"
              className="rounded-2xl px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Inbox
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-900">
          {label} {required ? <span className="text-slate-400">*</span> : null}
        </label>
        {error ? <span className="text-xs font-semibold text-red-600">Required</span> : null}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className={cn(
          "mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition",
          error
            ? "border-red-300 focus:ring-2 focus:ring-red-200"
            : "border-slate-200 focus:ring-2 focus:ring-[rgb(190,190,80)]/30"
        )}
      />
    </div>
  );
}

export default function CheckinTaskClient({ taskId }: { taskId: string }) {
  const router = useRouter();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [answers, setAnswers] = useState<Record<string, FieldAnswer>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setSubmitError(null);

      try {
        const res = await fetch(`/api/tasks/${taskId}`, { cache: "no-store" });
        const data = await res.json();
        if (ignore) return;

        // Keep compatible with your existing API shape
        setTask(data?.task ?? data ?? null);
      } catch (e: any) {
        if (!ignore) setSubmitError(e?.message ?? "Failed to load task");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [taskId]);

  // Minimal field map (UI only). If your existing code already builds fields dynamically from template_key,
  // you can swap this section with your current dynamic renderer — keep these styles.
  const fields = useMemo(() => {
    const key = (task?.template_key ?? task?.template?.template_key ?? "").toLowerCase();

    // You can expand these as your templates evolve without changing the UI shell.
    if (key === "daily_checkout") {
      return [
        { id: "wins", label: "What did you complete today?", required: true, placeholder: "Be specific." },
        { id: "missed", label: "What didn’t you complete and why?", required: true, placeholder: "Explain blockers." },
        { id: "tomorrow", label: "What’s the top priority tomorrow?", required: true, placeholder: "One clear priority." },
      ];
    }

    if (key === "weekly_checkin") {
      return [
        { id: "weekly_wins", label: "What went well this week?", required: true, placeholder: "Wins + evidence." },
        { id: "weekly_blockers", label: "What slowed you down?", required: true, placeholder: "Patterns + root cause." },
        { id: "next_week", label: "What are your priorities next week?", required: true, placeholder: "Top 3." },
      ];
    }

    // default daily_checkin
    return [
      { id: "priority", label: "What is your top priority today?", required: true, placeholder: "One measurable outcome." },
      { id: "plan", label: "What will you do to make progress?", required: true, placeholder: "Steps + focus blocks." },
      { id: "blockers", label: "Any blockers?", required: true, placeholder: "Anything that could stop you." },
    ];
  }, [task]);

  function validateRequired() {
    const missingIds = fields
      .filter((f) => f.required)
      .map((f) => f.id)
      .filter((id) => !String(answers[id] ?? "").trim());

    setMissing(missingIds);
    return missingIds.length === 0;
  }

  async function onSubmit() {
    setSubmitError(null);

    const ok = validateRequired();
    if (!ok) return;

    setSubmitting(true);
    try {
      // Keep your existing submit endpoint + payload shape.
      // IMPORTANT: your DB column is answers_json, so your API should insert answers_json.
      const res = await fetch(`/api/tasks/${taskId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Submit failed");

      // Return to Tasks as you requested
      router.replace("/tasks");
      router.refresh();
    } catch (e: any) {
      setSubmitError(e?.message ?? "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  const title = task?.template_title ?? task?.template?.title ?? "Check-in";
  const templateKey = task?.template_key ?? task?.template?.template_key ?? "unknown_template";
  const scheduled = task?.scheduled_for ? formatDisplayDate(task.scheduled_for) : null;

  return (
    <AppShell active="tasks" title={title} subtitle={scheduled ? `${scheduled} • ${templateKey}` : templateKey}>
      {loading ? (
        <Card>
          <div className="text-sm text-slate-600">Loading…</div>
        </Card>
      ) : !task ? (
        <Card>
          <div className="text-sm text-slate-600">Task not found.</div>
        </Card>
      ) : (
        <div className="space-y-4">
          {(submitError || missing.length > 0) && (
            <div
              className={cn(
                "rounded-2xl border px-4 py-3 text-sm",
                missing.length > 0 ? "border-red-200 bg-red-50" : "border-red-200 bg-red-50"
              )}
            >
              {missing.length > 0 ? (
                <>
                  <div className="font-semibold">Please complete all required questions</div>
                  <div className="mt-1 text-slate-700">You missed {missing.length} question(s).</div>
                </>
              ) : null}
              {submitError ? (
                <>
                  <div className="mt-2 font-semibold">Submission failed</div>
                  <div className="text-slate-700">{submitError}</div>
                </>
              ) : null}
            </div>
          )}

          <Card>
            <div className="space-y-5">
              {fields.map((f) => (
                <Field
                  key={f.id}
                  label={f.label}
                  required={f.required}
                  value={String(answers[f.id] ?? "")}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [f.id]: v }))}
                  error={missing.includes(f.id)}
                  placeholder={f.placeholder}
                />
              ))}
            </div>
          </Card>

          {/* Sticky action bar */}
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/85 backdrop-blur md:static md:border-0 md:bg-transparent">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
              <Link
                href="/tasks"
                className={cn(
                  "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold ring-1 transition",
                  submitting ? "opacity-50 pointer-events-none ring-slate-200" : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50"
                )}
              >
                Back
              </Link>

              <button
                onClick={onSubmit}
                disabled={submitting}
                className={cn(
                  "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition",
                  submitting ? "bg-slate-900/70 text-white" : "bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
