"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface Task {
  id: string;
  user_id: string;
  template_key?: string | null;
  template_title?: string | null;
  status: string;
  scheduled_for: string;
  created_at: string;
}

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-900">{children}</label>;
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-slate-500">{children}</p>;
}

function InputBase(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "mt-2 w-full rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400",
        "focus:border-[#c7c85a]/50 focus:outline-none focus:ring-2 focus:ring-[#c7c85a]/25",
        props.className
      )}
    />
  );
}

function TextareaBase(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        "mt-2 w-full rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400",
        "focus:border-[#c7c85a]/50 focus:outline-none focus:ring-2 focus:ring-[#c7c85a]/25",
        props.className
      )}
    />
  );
}

function SelectBase(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "mt-2 w-full rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-sm text-slate-900",
        "focus:border-[#c7c85a]/50 focus:outline-none focus:ring-2 focus:ring-[#c7c85a]/25",
        props.className
      )}
    />
  );
}

export default function CheckinTaskClient({ taskId }: { taskId: string; userId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpenDesktop, setSidebarOpenDesktop] = useState(true);

  const [banner, setBanner] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const res = await fetch(`/api/checkins/task?taskId=${taskId}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err.error || "Failed to load task");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setTask(data.task);
        setError(null);
      } catch {
        setError("Failed to fetch task");
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const handleSubmit = async (answers: Record<string, unknown>, missing: string[]) => {
    if (!task) return;

    if (missing.length > 0) {
      setBanner({
        type: "error",
        text: `Please complete all required fields: ${missing.join(", ")}.`,
      });
      return;
    }

    setSubmitting(true);
    setBanner(null);

    try {
      const res = await fetch("/api/checkins/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, answers }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setBanner({ type: "error", text: err.error || "Failed to submit" });
        setSubmitting(false);
        return;
      }

      setBanner({ type: "success", text: "Saved. Submission recorded." });
      router.replace("/tasks");
      router.refresh();
    } catch {
      setBanner({ type: "error", text: "Failed to submit check-in" });
      setSubmitting(false);
    }
  };

  const Sidebar = (
    <aside className={cx("flex h-full flex-col border-r border-slate-900/10 bg-white", sidebarOpenDesktop ? "w-80" : "w-20")}>
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="h-10 w-10 rounded-2xl bg-[#c7c85a]/30" />
        {sidebarOpenDesktop ? (
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">NetworkSpace</p>
            <p className="text-xs text-slate-500">AI Check-Ins</p>
          </div>
        ) : null}

        <button
          onClick={() => setSidebarOpenDesktop((v) => !v)}
          className={cx(
            "ml-auto rounded-xl border border-slate-900/10 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50",
            !sidebarOpenDesktop && "ml-0"
          )}
          aria-label="Toggle sidebar"
        >
          {sidebarOpenDesktop ? "⟨" : "⟩"}
        </button>
      </div>

      <nav className="px-3">
        {sidebarOpenDesktop ? (
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Menu</p>
        ) : null}

        <div className="space-y-1">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/workspace");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="h-2 w-2 rounded-full bg-slate-200" />
            {sidebarOpenDesktop ? <span>Workspace</span> : null}
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/tasks");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="h-2 w-2 rounded-full bg-slate-200" />
            {sidebarOpenDesktop ? <span>Tasks</span> : null}
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/inbox");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="h-2 w-2 rounded-full bg-slate-200" />
            {sidebarOpenDesktop ? <span>Inbox</span> : null}
          </button>
        </div>
      </nav>

      <div className="mt-auto border-t border-slate-900/10 px-5 py-4">
        <button
          onClick={handleSignOut}
          className="w-full rounded-2xl border border-slate-900/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </aside>
  );

  if (loading) return <div className="p-8 text-slate-600">Loading task…</div>;
  if (error || !task) return <div className="p-8 text-red-700">{error || "Task not found"}</div>;

  return (
    <main className="min-h-screen bg-white text-slate-900" suppressHydrationWarning>
      {!mounted ? null : (
        <>
          <div className="pointer-events-none fixed inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(199,200,90,0.18),transparent_45%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(15,23,42,0.06),transparent_55%)]" />
          </div>

          <div className="relative flex min-h-screen">
            <div className="hidden md:block">{Sidebar}</div>

            <div className="md:hidden fixed left-0 right-0 top-0 z-20 border-b border-slate-900/10 bg-white/90 backdrop-blur">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Menu
                </button>
                <div className="text-sm font-semibold text-slate-900">Check-in</div>
                <button
                  onClick={() => router.push("/tasks")}
                  className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Tasks
                </button>
              </div>
            </div>

            {mobileMenuOpen ? (
              <div className="md:hidden fixed inset-0 z-30">
                <div className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
                <div className="absolute inset-y-0 left-0">
                  <div className="h-full w-80">{Sidebar}</div>
                </div>
              </div>
            ) : null}

            <section className="flex-1 px-5 pb-8 pt-20 md:px-10 md:pt-8">
              <div className="mx-auto w-full max-w-2xl">
                <div className="mb-6">
                  <h1 className="text-2xl font-semibold">{task.template_title || task.template_key || "Check-in"}</h1>
                  <p className="mt-1 text-sm text-slate-500">Take 3–5 minutes. Answer fully. Submit once.</p>
                </div>

                {banner ? (
                  <div
                    className={cx(
                      "mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold",
                      banner.type === "success" && "border-emerald-300 bg-emerald-50 text-emerald-800",
                      banner.type === "error" && "border-red-300 bg-red-50 text-red-800",
                      banner.type === "info" && "border-slate-900/10 bg-slate-50 text-slate-800"
                    )}
                  >
                    {banner.text}
                  </div>
                ) : null}

                {/* Meta card */}
                <div className="mb-6 rounded-3xl border border-slate-900/10 bg-white p-5">
                  <div className="flex flex-wrap gap-2 text-xs text-slate-700">
                    <span className="rounded-full border border-slate-900/10 bg-slate-50 px-2.5 py-1">
                      <span className="text-slate-500">Status:</span> <span className="font-semibold">{task.status}</span>
                    </span>
                    <span className="rounded-full border border-slate-900/10 bg-slate-50 px-2.5 py-1">
                      <span className="text-slate-500">Scheduled:</span>{" "}
                      <span className="font-semibold">{new Date(task.scheduled_for).toLocaleString()}</span>
                    </span>
                  </div>
                </div>

                {task.status === "submitted" ? (
                  <div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-800">
                    This task has already been submitted.
                  </div>
                ) : !task.template_key ? (
                  <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6 text-amber-800">
                    Task has no template assigned.
                  </div>
                ) : (
                  <FormRenderer templateKey={task.template_key} onSubmit={handleSubmit} submitting={submitting} />
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function FormRenderer({
  templateKey,
  onSubmit,
  submitting,
}: {
  templateKey: string;
  onSubmit: (answers: Record<string, unknown>, missing: string[]) => void;
  submitting: boolean;
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const handleChange = (key: string, value: unknown) => setFormData((prev) => ({ ...prev, [key]: value }));

  const requiredKeysByTemplate: Record<string, string[]> = {
    daily_checkin: ["mood", "priorities"],
    daily_checkout: ["completed_priorities", "accomplishments", "energy_level"],
    weekly_checkin: ["wins", "challenges", "next_goals", "satisfaction"],
    onboarding_profile: ["full_name", "role", "bio", "goals"],
  };

  const missing = () => {
    const req = requiredKeysByTemplate[templateKey] ?? [];
    return req.filter((k) => {
      const v = formData[k];
      if (v === undefined || v === null) return true;
      if (typeof v === "string" && v.trim() === "") return true;
      return false;
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData, missing());
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-3xl border border-slate-900/10 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-5 space-y-6">{children}</div>
      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-2xl bg-[#2f343a] py-3 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </div>
  );

  if (templateKey === "daily_checkin") {
    return (
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <Section title="Daily Check-in">
          <div>
            <FieldLabel>How are you feeling today? (1–10)</FieldLabel>
            <FieldHint>Be honest — this helps calibrate workload and focus.</FieldHint>
            <InputBase
              type="number"
              min="1"
              max="10"
              required
              onChange={(e) => handleChange("mood", parseInt(e.target.value))}
            />
          </div>

          <div>
            <FieldLabel>What are your top 3 priorities today?</FieldLabel>
            <FieldHint>Write full sentences. Clarity beats speed.</FieldHint>
            <TextareaBase required rows={4} onChange={(e) => handleChange("priorities", e.target.value)} />
          </div>

          <div>
            <FieldLabel>Any blockers or concerns?</FieldLabel>
            <FieldHint>If none, say “None”.</FieldHint>
            <TextareaBase rows={3} onChange={(e) => handleChange("blockers", e.target.value)} />
          </div>
        </Section>
      </form>
    );
  }

  if (templateKey === "daily_checkout") {
    return (
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <Section title="Daily Check-out">
          <div>
            <FieldLabel>Did you complete your priorities?</FieldLabel>
            <FieldHint>Choose the closest option.</FieldHint>
            <SelectBase required onChange={(e) => handleChange("completed_priorities", e.target.value)}>
              <option value="">Select…</option>
              <option value="yes">Yes</option>
              <option value="partial">Partially</option>
              <option value="no">No</option>
            </SelectBase>
          </div>

          <div>
            <FieldLabel>What did you accomplish today?</FieldLabel>
            <FieldHint>List outcomes, not effort.</FieldHint>
            <TextareaBase required rows={4} onChange={(e) => handleChange("accomplishments", e.target.value)} />
          </div>

          <div>
            <FieldLabel>Energy level at end of day (1–10)</FieldLabel>
            <InputBase
              type="number"
              min="1"
              max="10"
              required
              onChange={(e) => handleChange("energy_level", parseInt(e.target.value))}
            />
          </div>
        </Section>
      </form>
    );
  }

  if (templateKey === "weekly_checkin") {
    return (
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <Section title="Weekly Check-in">
          <div>
            <FieldLabel>What were your key wins this week?</FieldLabel>
            <TextareaBase required rows={4} onChange={(e) => handleChange("wins", e.target.value)} />
          </div>

          <div>
            <FieldLabel>What challenges did you face?</FieldLabel>
            <TextareaBase required rows={4} onChange={(e) => handleChange("challenges", e.target.value)} />
          </div>

          <div>
            <FieldLabel>What are your goals for next week?</FieldLabel>
            <TextareaBase required rows={4} onChange={(e) => handleChange("next_goals", e.target.value)} />
          </div>

          <div>
            <FieldLabel>Overall satisfaction (1–10)</FieldLabel>
            <InputBase
              type="number"
              min="1"
              max="10"
              required
              onChange={(e) => handleChange("satisfaction", parseInt(e.target.value))}
            />
          </div>
        </Section>
      </form>
    );
  }

  if (templateKey === "onboarding_profile") {
    return (
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <Section title="Onboarding Profile">
          <div>
            <FieldLabel>Full Name</FieldLabel>
            <InputBase type="text" required onChange={(e) => handleChange("full_name", e.target.value)} />
          </div>

          <div>
            <FieldLabel>Role / Position</FieldLabel>
            <InputBase type="text" required onChange={(e) => handleChange("role", e.target.value)} />
          </div>

          <div>
            <FieldLabel>Tell us about yourself</FieldLabel>
            <TextareaBase required rows={5} onChange={(e) => handleChange("bio", e.target.value)} />
          </div>

          <div>
            <FieldLabel>What are your primary goals?</FieldLabel>
            <TextareaBase required rows={4} onChange={(e) => handleChange("goals", e.target.value)} />
          </div>
        </Section>
      </form>
    );
  }

  return (
    <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
      <p className="font-semibold">Unknown template: {templateKey}</p>
      <p className="mt-1 text-sm">This template is not currently supported. Please contact support.</p>
    </div>
  );
}
