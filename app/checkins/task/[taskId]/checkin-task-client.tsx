"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TemplateField =
  | { type: "text"; key: string; label: string; placeholder?: string }
  | { type: "textarea"; key: string; label: string; placeholder?: string }
  | { type: "number"; key: string; label: string; min?: number; max?: number };

type TaskPayload = {
  task: {
    id: number;
    template_key: string | null;
    template_title: string | null;
    scheduled_for: string | null;
  };
};

function templateFields(templateKey: string | null): TemplateField[] {
  // Keep your current “structure is good” requirement.
  // This is a clean placeholder mapping — align with your real templates as needed.
  switch (templateKey) {
    case "daily_checkin":
      return [
        { type: "textarea", key: "priority_1", label: "Top priority (1)", placeholder: "What matters most today?" },
        { type: "textarea", key: "priority_2", label: "Top priority (2)", placeholder: "Second most important outcome." },
        { type: "textarea", key: "blockers", label: "Blockers", placeholder: "Anything that could slow you down?" },
        { type: "number", key: "energy", label: "Energy (1–10)", min: 1, max: 10 },
      ];
    case "daily_checkout":
      return [
        { type: "textarea", key: "wins", label: "Wins", placeholder: "What did you get done today?" },
        { type: "textarea", key: "misses", label: "Misses", placeholder: "What didn’t happen and why?" },
        { type: "textarea", key: "tomorrow", label: "Tomorrow focus", placeholder: "What’s the first thing tomorrow?" },
        { type: "number", key: "day_rating", label: "Day rating (1–10)", min: 1, max: 10 },
      ];
    case "weekly_checkin":
      return [
        { type: "textarea", key: "weekly_wins", label: "Weekly wins", placeholder: "What moved the needle this week?" },
        { type: "textarea", key: "weekly_blockers", label: "Weekly blockers", placeholder: "What created friction?" },
        { type: "textarea", key: "next_week", label: "Next week plan", placeholder: "What’s the focus next week?" },
      ];
    case "onboarding_profile":
      return [
        { type: "text", key: "full_name", label: "Full name", placeholder: "Your name" },
        { type: "text", key: "role", label: "Role", placeholder: "Your role at NetworkSpace" },
        { type: "textarea", key: "goals", label: "Goals", placeholder: "What are you working toward?" },
      ];
    default:
      return [
        { type: "textarea", key: "response", label: "Response", placeholder: "Answer here…" },
      ];
  }
}

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

export default function CheckinTaskClient({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<TaskPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fields = useMemo(() => {
    const key = payload?.task?.template_key ?? null;
    return templateFields(key);
  }, [payload?.task?.template_key]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/checkins/task/${taskId}/api/task`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load task");
      setPayload(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load task");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  function validate() {
    const missingKeys: string[] = [];
    for (const f of fields) {
      const v = answers[f.key];
      const isEmpty =
        v === null ||
        v === undefined ||
        (typeof v === "string" && v.trim().length === 0);
      if (isEmpty) missingKeys.push(f.key);
    }
    setMissing(missingKeys);
    return missingKeys.length === 0;
  }

  async function submit() {
    if (submitting) return;
    const ok = validate();
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/checkins/task/${taskId}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers_json: answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Submission failed");

      // Back to tasks (your desired flow)
      router.replace("/tasks");
    } catch (e: any) {
      setError(e?.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  const title = payload?.task?.template_title ?? payload?.task?.template_key ?? "Check-in";

  return (
    <div>
      {loading ? (
        <div className="space-y-3">
          <div className="h-6 w-1/2 rounded-xl bg-[var(--ns-bg)]" />
          <div className="h-20 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)]" />
          <div className="h-20 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)]" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)] p-4">
          <div className="text-sm font-semibold">Something went wrong</div>
          <div className="mt-1 text-sm text-black/60">{error}</div>
          <button
            onClick={load}
            className="mt-3 rounded-2xl bg-[var(--ns-charcoal)] px-4 py-2 text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      ) : !payload?.task ? (
        <div className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)] p-4">
          <div className="text-sm font-semibold">Task not found</div>
        </div>
      ) : (
        <div>
          <div className="mb-4 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)] p-4">
            <div className="text-sm font-semibold">{title}</div>
            <div className="mt-1 text-xs text-black/55">
              Scheduled: {formatDateTime(payload.task.scheduled_for)}
            </div>
          </div>

          {missing.length > 0 && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm font-semibold">Please complete all questions</div>
              <div className="mt-1 text-sm text-red-700">
                You missed {missing.length} field{missing.length === 1 ? "" : "s"}.
              </div>
            </div>
          )}

          <div className="space-y-4">
            {fields.map((f) => {
              const isMissing = missing.includes(f.key);
              const base =
                "w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2";
              const cls = isMissing
                ? `${base} border-red-300 focus:ring-red-200`
                : `${base} border-[var(--ns-border)] focus:ring-[var(--ns-olive)]/50`;

              return (
                <div key={f.key}>
                  <label className="block text-sm font-medium">
                    {f.label}{" "}
                    <span className="text-xs text-black/40">(required)</span>
                  </label>

                  <div className="mt-2">
                    {f.type === "textarea" ? (
                      <textarea
                        className={cls}
                        rows={4}
                        placeholder={f.placeholder ?? ""}
                        value={String(answers[f.key] ?? "")}
                        onChange={(e) =>
                          setAnswers((a) => ({ ...a, [f.key]: e.target.value }))
                        }
                      />
                    ) : f.type === "number" ? (
                      <input
                        className={cls}
                        type="number"
                        min={f.min}
                        max={f.max}
                        placeholder={f.placeholder ?? ""}
                        value={answers[f.key] ?? ""}
                        onChange={(e) =>
                          setAnswers((a) => ({
                            ...a,
                            [f.key]: e.target.value === "" ? "" : Number(e.target.value),
                          }))
                        }
                      />
                    ) : (
                      <input
                        className={cls}
                        type="text"
                        placeholder={f.placeholder ?? ""}
                        value={String(answers[f.key] ?? "")}
                        onChange={(e) =>
                          setAnswers((a) => ({ ...a, [f.key]: e.target.value }))
                        }
                      />
                    )}
                  </div>

                  {isMissing && (
                    <div className="mt-1 text-xs text-red-700">This is required.</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.replace("/tasks")}
              className="rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-2 text-sm font-medium hover:bg-black/5"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="rounded-2xl bg-[var(--ns-charcoal)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
