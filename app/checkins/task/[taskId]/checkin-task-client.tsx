"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type TemplateJoin = {
  template_key: string | null;
  title: string | null;
};

type TaskResponse = {
  task?: {
    id: string;
    template_id: string;
    template?: TemplateJoin | TemplateJoin[] | null;
    scheduled_for?: string | null;
  } | null;
};

type SubmitResponse = { success?: boolean; error?: string };

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatDT(dt: string | null | undefined) {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dt));
  } catch {
    return String(dt);
  }
}

function normalizeTemplate(t: TemplateJoin | TemplateJoin[] | null | undefined): TemplateJoin | null {
  if (!t) return null;
  if (Array.isArray(t)) return t[0] ?? null;
  return t;
}

export default function CheckinTaskClient() {
  const router = useRouter();
  const params = useParams<{ taskId: string }>();
  const taskId = params?.taskId;

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState<string>("Check-in");
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);

  // Answers (single-page forms)
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // Validation
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const [showValidation, setShowValidation] = useState(false);

  // Simple field definitions per templateKey (no new files)
  const fields = useMemo(() => {
    // Keep it simple; adapt keys to your templates as needed.
    // These keys become answers_json keys.
    if (templateKey === "daily_checkin") {
      return [
        { key: "top_focus", label: "What are your top priorities today?", type: "textarea", required: true },
        { key: "blockers", label: "Any blockers or risks?", type: "textarea", required: true },
        { key: "support_needed", label: "Support needed (if any)?", type: "textarea", required: true },
      ];
    }

    if (templateKey === "daily_checkout") {
      return [
        { key: "done_today", label: "What did you complete today?", type: "textarea", required: true },
        { key: "learned", label: "What did you learn today?", type: "textarea", required: true },
        { key: "tomorrow", label: "What are you committing to tomorrow?", type: "textarea", required: true },
      ];
    }

    if (templateKey === "weekly_checkin") {
      return [
        { key: "wins", label: "Key wins this week?", type: "textarea", required: true },
        { key: "challenges", label: "Key challenges this week?", type: "textarea", required: true },
        { key: "next_week", label: "Next week priorities?", type: "textarea", required: true },
      ];
    }

    if (templateKey === "onboarding_profile") {
      return [
        { key: "role", label: "Your role", type: "text", required: true },
        { key: "goals", label: "Your goals in the next 30 days", type: "textarea", required: true },
      ];
    }

    // Fallback: hard-fail if missing template configuration
    return [];
  }, [templateKey]);

  useEffect(() => {
    if (!taskId) return;

    async function loadTask() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/checkins/task?taskId=${encodeURIComponent(taskId)}`);
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`Failed to load task (${res.status}): ${t}`);
        }

        const data = (await res.json()) as TaskResponse;
        const task = data.task;

        if (!task) throw new Error("Task not found.");

        const tmpl = normalizeTemplate(task.template);
        const key = tmpl?.template_key ?? null;
        const title = tmpl?.title ?? "Check-in";

        if (!key) {
          // Hard-fail per your principle
          throw new Error("Misconfigured task: missing template_key.");
        }

        setTemplateKey(key);
        setTaskTitle(title);
        setScheduledFor(task.scheduled_for ?? null);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load task");
      } finally {
        setLoading(false);
      }
    }

    void loadTask();
  }, [taskId]);

  function validate() {
    const missing: string[] = [];
    for (const f of fields) {
      if (!f.required) continue;
      const v = answers[f.key];
      const empty =
        v === null ||
        v === undefined ||
        (typeof v === "string" && v.trim().length === 0);
      if (empty) missing.push(f.key);
    }
    setMissingKeys(missing);
    return missing.length === 0;
  }

  async function handleSubmit() {
    setShowValidation(true);

    if (!templateKey || fields.length === 0) {
      setError("Template configuration missing. Cannot submit.");
      return;
    }

    const ok = validate();
    if (!ok) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/checkins/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          answers_json: answers, // IMPORTANT: matches your DB column
        }),
      });

      const data = (await res.json().catch(() => ({}))) as SubmitResponse;

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `Submit failed (${res.status})`);
      }

      // Back to tasks
      router.replace("/tasks");
    } catch (e: any) {
      setError(e?.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ns-surface)] text-[var(--ns-charcoal)]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(199,199,74,0.18),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_35%,rgba(17,24,39,0.08),transparent_45%)]" />
      </div>

      <div className="relative mx-auto min-h-screen w-full max-w-3xl px-4 py-4 md:px-6 md:py-6">
        <header className="flex items-center justify-between rounded-2xl border border-[var(--ns-border)] bg-white/70 px-4 py-3 backdrop-blur">
          <div className="leading-tight">
            <div className="text-sm font-semibold">{taskTitle}</div>
            <div className="text-xs text-slate-500">
              {scheduledFor ? `Scheduled • ${formatDT(scheduledFor)}` : "Scheduled time not set"}
            </div>
          </div>

          <button
            onClick={() => router.push("/tasks")}
            className="inline-flex items-center rounded-xl border border-[var(--ns-border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--ns-muted)]"
          >
            Back
          </button>
        </header>

        <section className="mt-4 rounded-2xl border border-[var(--ns-border)] bg-white/70 backdrop-blur">
          <div className="border-b border-[var(--ns-border)] px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Check-in form
            </div>
          </div>

          <div className="px-4 py-4">
            {loading ? (
              <div className="space-y-3">
                <div className="h-24 rounded-2xl border border-[var(--ns-border)] bg-white" />
                <div className="h-24 rounded-2xl border border-[var(--ns-border)] bg-white" />
                <div className="h-24 rounded-2xl border border-[var(--ns-border)] bg-white" />
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-4 text-sm text-slate-800">
                <div className="font-bold text-slate-900">Unable to load</div>
                <div className="mt-1 text-slate-600">{error}</div>
              </div>
            ) : fields.length === 0 ? (
              <div className="rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-4 text-sm text-slate-800">
                <div className="font-bold text-slate-900">Template not configured</div>
                <div className="mt-1 text-slate-600">
                  This task is missing a UI definition for its template. (Hard fail by design.)
                </div>
              </div>
            ) : (
              <>
                {/* Validation summary */}
                {showValidation && missingKeys.length > 0 ? (
                  <div className="mb-4 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-olive-soft)] px-4 py-3 text-sm text-slate-800">
                    <div className="font-bold">You missed {missingKeys.length} question(s).</div>
                    <div className="mt-1 text-slate-700">Please answer all required questions before submitting.</div>
                  </div>
                ) : null}

                <div className="space-y-4">
                  {fields.map((f) => {
                    const missing = showValidation && missingKeys.includes(f.key);
                    return (
                      <div key={f.key} className="rounded-2xl border border-[var(--ns-border)] bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <label className="text-sm font-bold text-slate-900">
                            {f.label} {f.required ? <span className="text-slate-500">*</span> : null}
                          </label>
                          {missing ? (
                            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
                              Required
                            </span>
                          ) : null}
                        </div>

                        {f.type === "textarea" ? (
                          <textarea
                            rows={5}
                            value={String(answers[f.key] ?? "")}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [f.key]: e.target.value }))}
                            className={cn(
                              "mt-3 w-full resize-none rounded-2xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none",
                              missing ? "border-slate-900" : "border-[var(--ns-border)]"
                            )}
                            placeholder="Type your answer…"
                          />
                        ) : (
                          <input
                            value={String(answers[f.key] ?? "")}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [f.key]: e.target.value }))}
                            className={cn(
                              "mt-3 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none",
                              missing ? "border-slate-900" : "border-[var(--ns-border)]"
                            )}
                            placeholder="Type your answer…"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Sticky submit bar (mobile-first) */}
                <div className="sticky bottom-4 mt-6">
                  {error ? (
                    <div className="mb-3 rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-3 text-sm text-slate-700">
                      {error}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between rounded-2xl border border-[var(--ns-border)] bg-white/80 px-4 py-3 backdrop-blur">
                    <div className="text-xs text-slate-500">
                      All questions are required.
                    </div>

                    <button
                      onClick={() => void handleSubmit()}
                      disabled={submitting}
                      className={cn(
                        "inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold",
                        submitting
                          ? "bg-slate-200 text-slate-500"
                          : "bg-[var(--ns-olive)] text-[var(--ns-charcoal)] hover:opacity-95"
                      )}
                    >
                      {submitting ? "Submitting…" : "Submit"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
