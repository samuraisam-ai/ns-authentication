"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Task {
  id: string;
  user_id: string;
  template_key?: string | null;
  template_title?: string | null;
  status: string;
  scheduled_for: string;
  created_at: string;
  submitted_at?: string | null;
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

type FieldType = "text" | "textarea" | "number" | "slider" | "select";

type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string }>;
  help?: string;
};

const TEMPLATE_FIELDS: Record<string, { title: string; fields: FieldDef[] }> = {
  daily_checkin: {
    title: "Daily Check-In",
    fields: [
      {
        key: "mood",
        label: "How are you feeling today? (1–10)",
        type: "slider",
        required: true,
        min: 1,
        max: 10,
        help: "Be honest. This helps identify patterns early.",
      },
      {
        key: "priorities",
        label: "What are your top 3 priorities today?",
        type: "textarea",
        required: true,
        placeholder: "1) …\n2) …\n3) …",
      },
      {
        key: "blockers",
        label: "Any blockers or risks?",
        type: "textarea",
        required: true,
        placeholder: "If none, write “No blockers”.",
      },
      {
        key: "support_needed",
        label: "Support needed from your manager or team?",
        type: "textarea",
        required: true,
        placeholder: "If none, write “No support needed”.",
      },
    ],
  },
  daily_checkout: {
    title: "Daily Check-Out",
    fields: [
      {
        key: "wins",
        label: "What did you complete today?",
        type: "textarea",
        required: true,
        placeholder: "List completed work clearly.",
      },
      {
        key: "misses",
        label: "What did you not complete — and why?",
        type: "textarea",
        required: true,
        placeholder: "Be direct. Clarity beats excuses.",
      },
      {
        key: "tomorrow",
        label: "What will you focus on tomorrow?",
        type: "textarea",
        required: true,
        placeholder: "Top priorities for tomorrow.",
      },
      {
        key: "mood_end",
        label: "How do you feel at end of day? (1–10)",
        type: "slider",
        required: true,
        min: 1,
        max: 10,
      },
    ],
  },
  weekly_checkin: {
    title: "Weekly Reflection",
    fields: [
      {
        key: "highlights",
        label: "Highlights of the week",
        type: "textarea",
        required: true,
      },
      {
        key: "challenges",
        label: "Challenges / blockers encountered",
        type: "textarea",
        required: true,
      },
      {
        key: "lessons",
        label: "Key lessons learned",
        type: "textarea",
        required: true,
      },
      {
        key: "next_week",
        label: "Focus for next week",
        type: "textarea",
        required: true,
      },
    ],
  },
  onboarding_profile: {
    title: "Onboarding Profile",
    fields: [
      { key: "role", label: "Your role", type: "text", required: true, placeholder: "e.g. Broker" },
      { key: "branch", label: "Branch", type: "text", required: true, placeholder: "e.g. Parktown" },
      { key: "experience", label: "Experience level", type: "text", required: true, placeholder: "e.g. 2 years" },
      {
        key: "goals",
        label: "What does success look like for you?",
        type: "textarea",
        required: true,
      },
    ],
  },
};

function Toast({
  open,
  title,
  body,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-x-0 top-3 z-50 mx-auto w-full max-w-lg px-3">
      <div className="rounded-2xl bg-slate-900 text-white shadow-[0_18px_60px_rgba(2,6,23,0.35)] ring-1 ring-white/10">
        <div className="flex items-start gap-3 p-4">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#B8BE3B]" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{title}</div>
            {body ? <div className="mt-1 text-sm text-white/75">{body}</div> : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CheckinTaskClient({
  taskId,
  userId,
}: {
  taskId: string;
  userId: string;
}) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastBody, setToastBody] = useState<string | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const res = await fetch(`/api/checkins/task?taskId=${taskId}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError((err as any).error || "Failed to load task");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setTask(data.task);
      } catch {
        setError("Failed to fetch task");
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [taskId]);

  function showToast(title: string, body?: string) {
    setToastTitle(title);
    setToastBody(body);
    setToastOpen(true);
    window.setTimeout(() => setToastOpen(false), 2600);
  }

  const template = useMemo(() => {
    const key = task?.template_key ?? "";
    return TEMPLATE_FIELDS[key] ?? null;
  }, [task?.template_key]);

  const handleSubmit = async (answers: Record<string, unknown>) => {
    if (!task) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkins/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, answers }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast("Submission failed", (err as any).error || "Please try again.");
        setSubmitting(false);
        return;
      }

      showToast("Submitted", "Your check-in has been recorded.");
      router.replace("/tasks");
      router.refresh();
    } catch {
      showToast("Submission failed", "Please check your connection and try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-slate-600">Loading task…</div>;
  }

  if (error || !task) {
    return (
      <div className="rounded-2xl bg-red-50 p-6 text-red-700 ring-1 ring-red-200">
        {error || "Task not found"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Toast open={toastOpen} title={toastTitle} body={toastBody} onClose={() => setToastOpen(false)} />

      <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-900/10 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Check-In</h1>
          <p className="mt-1 text-sm text-slate-600">
            Keep it clear. Answer all questions in full.
          </p>
        </div>
      </div>

      {/* Task meta */}
      <div className="mb-6 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-[#B8BE3B]/15 px-3 py-1 text-xs font-semibold text-slate-900 ring-1 ring-[#B8BE3B]/35">
            {task.template_title || task.template_key || "No template"}
          </span>
          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            Status: {task.status}
          </span>
          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            Scheduled: {formatDateTime(task.scheduled_for)}
          </span>
        </div>
      </div>

      {task.status === "submitted" ? (
        <div className="rounded-2xl bg-emerald-50 p-6 text-emerald-800 ring-1 ring-emerald-200">
          This task has already been submitted.
        </div>
      ) : !task.template_key ? (
        <div className="rounded-2xl bg-[#B8BE3B]/15 p-6 text-slate-900 ring-1 ring-[#B8BE3B]/35">
          Task has no template assigned.
        </div>
      ) : !template ? (
        <div className="rounded-2xl bg-red-50 p-6 text-red-700 ring-1 ring-red-200">
          Unknown template: <span className="font-semibold">{task.template_key}</span>
        </div>
      ) : (
        <DynamicForm
          title={template.title}
          fields={template.fields}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  );
}

function DynamicForm({
  title,
  fields,
  onSubmit,
  submitting,
}: {
  title: string;
  fields: FieldDef[];
  onSubmit: (answers: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const requiredKeys = useMemo(
    () => fields.filter((f) => f.required).map((f) => f.key),
    [fields]
  );

  const missing = useMemo(() => {
    const list: FieldDef[] = [];
    for (const f of fields) {
      if (!f.required) continue;
      const v = formData[f.key];
      const empty =
        v === undefined ||
        v === null ||
        (typeof v === "string" && v.trim().length === 0);
      if (empty) list.push(f);
    }
    return list;
  }, [fields, formData]);

  const handleChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const next: Record<string, string> = {};
    for (const f of fields) {
      if (!f.required) continue;
      const v = formData[f.key];
      const empty =
        v === undefined ||
        v === null ||
        (typeof v === "string" && v.trim().length === 0);
      if (empty) next[f.key] = "Required";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!validate()) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleFormSubmit} className="pb-24">
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">
          All questions are required. Take a moment to answer properly.
        </p>

        {/* Missing summary */}
        {submitAttempted && missing.length > 0 ? (
          <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
            <div className="font-semibold">Please complete {missing.length} required item(s):</div>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              {missing.map((f) => (
                <li key={f.key}>{f.label}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          {fields.map((f) => {
            const err = errors[f.key];
            const value = formData[f.key];

            return (
              <div key={f.key} className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900">
                  {f.label} {f.required ? <span className="text-red-600">*</span> : null}
                </label>
                {f.help ? <div className="text-xs text-slate-500">{f.help}</div> : null}

                {f.type === "text" ? (
                  <input
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className={cx(
                      "w-full rounded-2xl border bg-white px-3 py-3 text-sm outline-none",
                      err ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-slate-400"
                    )}
                  />
                ) : f.type === "textarea" ? (
                  <textarea
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    rows={5}
                    className={cx(
                      "w-full rounded-2xl border bg-white px-3 py-3 text-sm outline-none",
                      err ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-slate-400"
                    )}
                  />
                ) : f.type === "number" ? (
                  <input
                    type="number"
                    min={f.min}
                    max={f.max}
                    value={typeof value === "number" ? value : ""}
                    onChange={(e) => handleChange(f.key, Number(e.target.value))}
                    className={cx(
                      "w-full rounded-2xl border bg-white px-3 py-3 text-sm outline-none",
                      err ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-slate-400"
                    )}
                  />
                ) : f.type === "slider" ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">{f.min ?? 1}</span>
                      <span className="inline-flex items-center rounded-full bg-[#B8BE3B]/15 px-3 py-1 text-xs font-bold text-slate-900 ring-1 ring-[#B8BE3B]/35">
                        {typeof value === "number" ? value : "—"}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">{f.max ?? 10}</span>
                    </div>
                    <input
                      type="range"
                      min={f.min ?? 1}
                      max={f.max ?? 10}
                      value={typeof value === "number" ? value : (f.min ?? 1)}
                      onChange={(e) => handleChange(f.key, Number(e.target.value))}
                      className="mt-3 w-full accent-slate-900"
                    />
                    {err ? <div className="mt-2 text-xs font-semibold text-red-600">{err}</div> : null}
                  </div>
                ) : f.type === "select" ? (
                  <select
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    className={cx(
                      "w-full rounded-2xl border bg-white px-3 py-3 text-sm outline-none",
                      err ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-slate-400"
                    )}
                  >
                    <option value="">Select…</option>
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : null}

                {err && f.type !== "slider" ? (
                  <div className="text-xs font-semibold text-red-600">{err}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky submit bar (mobile-first) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-3 py-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-600">Required</div>
            <div className="text-sm font-semibold text-slate-900">
              {submitAttempted && missing.length > 0
                ? `${missing.length} missing`
                : `${requiredKeys.length} fields`}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={cx(
              "rounded-xl px-5 py-3 text-sm font-semibold text-white",
              submitting ? "bg-slate-400" : "bg-slate-900 hover:bg-slate-800"
            )}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </form>
  );
}
