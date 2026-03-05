"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { MENU_BUBBLE_BUTTON, MENU_EXPANDABLE_BUTTON } from "@/lib/menu-styles";
import AppMenu from "@/app/components/AppMenu";

interface Task {
  id: string;
  user_id: string;
  template_key?: string | null;
  template_title?: string | null;
  status: string;
  scheduled_for: string;
  created_at: string;
}

type Session = {
  id: string;
  title: string;
  updated_at: string;
};

type MenuTask = {
  id: string;
  status: string;
  scheduled_for: string;
  template_key: string;
  template_title: string;
};

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pendingTasks, setPendingTasks] = useState<MenuTask[]>([]);

  const [banner, setBanner] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    void fetchTasksForMenu();
  }, []);

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

  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!task?.user_id) {
        setPendingCount(0);
        return;
      }

      try {
        const { count } = await supabase
          .from("checkin_tasks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", task.user_id)
          .in("status", ["pending", "overdue"]);

        setPendingCount(count ?? 0);
      } catch {
        setPendingCount(0);
      }
    };

    void fetchPendingCount();
  }, [supabase, task?.user_id]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function loadSessions() {
    try {
      const res = await fetch("/api/chat/sessions");
      if (!res.ok) return;
      const data = (await res.json()) as { sessions?: Session[] };
      setSessions(data.sessions ?? []);
    } catch {
      setSessions([]);
    }
  }

  async function fetchTasksForMenu() {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) return;
      const data = await res.json();
      const allTasks = (data.tasks ?? []) as MenuTask[];
      setPendingTasks(allTasks.filter((item) => item.status === "pending" || item.status === "overdue"));
    } catch {
      setPendingTasks([]);
    }
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
      const res = await fetch("/api/checkins/submit-and-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, answers }),
      });

      if (res.status === 409) {
        setBanner({ type: "success", text: "Already submitted ✅" });
        setTimeout(() => {
          router.push("/tasks");
          router.refresh();
        }, 800);
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setBanner({ type: "error", text: err.error || "Failed to submit" });
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      const sessionId = data?.sessionId;

      if (!sessionId) {
        setBanner({ type: "error", text: "No session created" });
        setSubmitting(false);
        return;
      }

      setBanner({ type: "success", text: "Submitted ✅" });
      setTimeout(() => {
        router.push(`/workspace?sessionId=${sessionId}`);
      }, 800);
    } catch {
      setBanner({ type: "error", text: "Failed to submit check-in" });
      setSubmitting(false);
    }
  };

  const SidebarContent = (
    <aside className="fixed inset-0 z-50 flex h-full flex-col bg-white">
      <AppMenu onClose={() => setMenuOpen(false)} />

      <div className="sticky bottom-0 mt-auto border-t border-slate-900/10 bg-white px-4 py-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <img
            src="https://res.cloudinary.com/dtjysgyny/image/upload/v1772030126/logout_icon_transparent_leznaq.png"
            alt=""
            aria-hidden="true"
            className="h-7 w-7 object-contain"
          />
          Sign out
        </button>
      </div>
    </aside>
  );

  if (loading) return <div className="p-8 text-slate-600">Loading task…</div>;
  if (error || !task) return <div className="p-8 text-red-700">{error || "Task not found"}</div>;

  const isDailyCheckin = task.template_key === "daily_checkin";
  const isDailyCheckout = task.template_key === "daily_checkout";
  const isWeekly = task.template_key === "weekly_checkin" || task.template_key === "weekly_checkout";
  const isDailyStyle = isDailyCheckin || isDailyCheckout;
  const showDailySubmitDock = isDailyStyle && task.status !== "submitted" && Boolean(task.template_key);
  const scheduledDate = new Date(task.scheduled_for);
  const scheduledDateLabel = Number.isNaN(scheduledDate.getTime())
    ? "--"
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(scheduledDate);

  return (
    <main className={cx("min-h-screen text-slate-900", isDailyStyle ? "bg-[#eaeaea]" : "bg-white")} suppressHydrationWarning>
      {!mounted ? null : (
        <>
          {isDailyCheckin || isDailyCheckout || isWeekly ? (
            <>
              <header className="sticky top-0 z-20 w-full border-b border-black/10 bg-white px-5 py-4 md:px-10">
                <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <button type="button" onClick={() => router.push("/tasks")} aria-label="Go to tasks">
                        <img
                          src="https://res.cloudinary.com/dtjysgyny/image/upload/v1771966266/NS_Logos-01_1_2_snskdp.png"
                          alt="NS logo"
                          className="h-9 w-9 object-contain"
                        />
                      </button>
                      {pendingCount > 0 ? (
                        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                          {pendingCount > 99 ? "99+" : pendingCount}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-lg text-slate-900">
                      <span className="font-semibold">NS</span>{" "}
                      <span className="font-medium">Coach</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMenuOpen(true)}
                    className="inline-flex items-center justify-center"
                    aria-label="Open menu"
                  >
                    <span className="flex flex-col gap-1">
                      <span className="block h-[2px] w-6 bg-[#d8cd72]" />
                      <span className="block h-[2px] w-6 bg-[#d8cd72]" />
                      <span className="block h-[2px] w-6 bg-[#d8cd72]" />
                    </span>
                  </button>
                </div>
              </header>

              <button
                type="button"
                onClick={() => router.push("/tasks")}
                className="w-full bg-[#b4b4b4] px-5 py-3 text-left text-sm font-semibold text-[#737373] md:px-10"
                aria-label="Back To Tasks"
              >
                ← Back To Tasks
              </button>

              <div className="w-full bg-[#f0f1c9] px-5 py-5 md:px-10">
                <div className="mx-auto w-full max-w-4xl px-3 md:px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className={cx(isWeekly && "min-w-0 flex-1")}>
                      <h1
                        className={cx(
                          "font-bold text-slate-900",
                          isWeekly ? "min-w-0 whitespace-nowrap truncate text-xl" : "text-2xl"
                        )}
                      >
                        {isWeekly ? "Weekly Check-out" : isDailyCheckout ? "Daily Check-out" : "Daily Check-in"}
                      </h1>
                    </div>
                    <span className="shrink-0 rounded-md bg-[#545454] px-3 py-1.5 text-sm font-bold text-white">{scheduledDateLabel}</span>
                  </div>
                  {isWeekly ? (
                    <p className="mt-3 text-sm text-slate-900">
                      Reflect on your week with honesty. Answer the questions below to capture what fueled you, what tested you,
                      and what you’ll improve next week.
                    </p>
                  ) : isDailyCheckout ? (
                    <>
                      <p className="mt-3 text-sm text-slate-900">
                        How did it go? For each of your 3 priorities, write what got done. Then mark the status:
                      </p>
                      <div className="mt-3 space-y-2.5">
                        <div className="flex items-center gap-3">
                          <span className="h-5 w-5 rounded-full bg-green-500" aria-hidden="true" />
                          <span className="text-sm text-slate-900">100% done</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="h-5 w-5 rounded-full bg-orange-500" aria-hidden="true" />
                          <span className="text-sm text-slate-900">50-75% done</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="h-5 w-5 rounded-full bg-red-500" aria-hidden="true" />
                          <span className="text-sm text-slate-900">Less than 50% done</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="h-5 w-5 rounded-full bg-blue-500" aria-hidden="true" />
                          <span className="text-sm text-slate-900">Deprioritised</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-slate-900">
                      List your top three priorities for today below. It should be easy to know if you got it done or not.at the end of the day.
                    </p>
                  )}
                </div>
              </div>

              <div className="h-px w-full bg-[#545454]" />

              {menuOpen ? SidebarContent : null}

              <section
                className={cx(
                  "mx-auto w-full max-w-4xl px-7 pt-4 md:px-10 md:pt-6",
                  showDailySubmitDock ? "pb-28" : "pb-8"
                )}
              >
                <div className="mx-auto w-full max-w-2xl">
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

              {showDailySubmitDock ? (
                <div className="fixed inset-x-0 bottom-0 z-40 w-full bg-[#545454] px-5 py-4 md:px-10">
                  <div className="mx-auto w-full max-w-4xl">
                    <button
                      type="submit"
                      form="daily-checkin-form"
                      className="w-full rounded-2xl bg-[#d8cd72] py-3 text-sm font-bold text-white"
                    >
                      {isDailyCheckout ? "Submit Check-out" : "Submit Check-in"}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
          <div className="pointer-events-none fixed inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(199,200,90,0.18),transparent_45%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(15,23,42,0.06),transparent_55%)]" />
          </div>

          <div className="relative flex min-h-screen">
            <div className="md:hidden fixed left-0 right-0 top-0 z-20 border-b border-slate-900/10 bg-white/90 backdrop-blur">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setMenuOpen(true)}
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

            {menuOpen ? SidebarContent : null}

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
  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [openStatusFor, setOpenStatusFor] = useState<null | 1 | 2 | 3>(null);

  const handleChange = (key: string, value: string | number | boolean | null) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const getInputValue = (key: string): string | number => {
    const value = formData[key];
    return typeof value === "string" || typeof value === "number" ? value : "";
  };

  const checkoutStatusKeys = ["done_100", "done_50_75", "less_than_50", "deprioritised"] as const;
  const checkoutStatusColorByKey: Record<(typeof checkoutStatusKeys)[number], string> = {
    done_100: "bg-green-500",
    done_50_75: "bg-orange-500",
    less_than_50: "bg-red-500",
    deprioritised: "bg-blue-500",
  };

  const requiredKeysByTemplate: Record<string, string[]> = {
    daily_checkin: ["priority_1", "priority_2", "priority_3"],
    daily_checkout: ["outcome_1", "outcome_2", "outcome_3", "status_1", "status_2", "status_3"],
    weekly_checkin: [
      "leads_count",
      "leads_explanation",
      "viewings_count",
      "viewings_explanation",
      "leases_count",
      "leases_explanation"
    ],
    weekly_checkout: [
      "leads_count",
      "leads_explanation",
      "viewings_count",
      "viewings_explanation",
      "leases_count",
      "leases_explanation"
    ],
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
    if (templateKey === "daily_checkin") {
      const priority1 = String(formData.priority_1 ?? "").trim();
      const priority2 = String(formData.priority_2 ?? "").trim();
      const priority3 = String(formData.priority_3 ?? "").trim();

      const combinedPriorities = `1) ${priority1}\n2) ${priority2}\n3) ${priority3}`;
      onSubmit({ ...formData, priorities: combinedPriorities }, missing());
      return;
    }

    if (templateKey === "daily_checkout") {
      const outcome1 = String(formData.outcome_1 ?? "").trim();
      const outcome2 = String(formData.outcome_2 ?? "").trim();
      const outcome3 = String(formData.outcome_3 ?? "").trim();
      const status1 = String(formData.status_1 ?? "").trim();
      const status2 = String(formData.status_2 ?? "").trim();
      const status3 = String(formData.status_3 ?? "").trim();

      const combinedOutcomes = `1) ${outcome1}\n2) ${outcome2}\n3) ${outcome3}`;
      const checkoutAnswers = {
        ...formData,
        accomplishments: combinedOutcomes,
        outcomes: {
          outcome_1: outcome1,
          outcome_2: outcome2,
          outcome_3: outcome3,
        },
        statuses: {
          status_1: status1,
          status_2: status2,
          status_3: status3,
        },
        status_1: status1,
        status_2: status2,
        status_3: status3,
        completed_priorities: formData.completed_priorities ?? "partial",
        energy_level: formData.energy_level ?? 5,
      };

      const checkoutMissing = (requiredKeysByTemplate.daily_checkout ?? []).filter((k) => {
        const v = checkoutAnswers[k as keyof typeof checkoutAnswers];
        if (v === undefined || v === null) return true;
        if (typeof v === "string" && v.trim() === "") return true;
        return false;
      });

      const checkoutFieldLabels: Record<string, string> = {
        outcome_1: "Task 1 outcome",
        outcome_2: "Task 2 outcome",
        outcome_3: "Task 3 outcome",
        status_1: "Task 1 status",
        status_2: "Task 2 status",
        status_3: "Task 3 status",
      };

      onSubmit(
        checkoutAnswers,
        checkoutMissing.map((fieldKey) => checkoutFieldLabels[fieldKey] ?? fieldKey)
      );
      return;
    }

    onSubmit(formData, missing());
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-3xl border border-slate-900/10 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-5 space-y-6">{children}</div>
      {templateKey !== "daily_checkin" ? (
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-2xl bg-[#2f343a] py-3 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
        >
          {submitting
            ? "Submitting…"
            : templateKey === "weekly_checkin" || templateKey === "weekly_checkout"
              ? "Submit Check-out"
              : "Submit"}
        </button>
      ) : null}
    </div>
  );

  if (templateKey === "daily_checkin") {
    return (
      <form id="daily-checkin-form" onSubmit={handleFormSubmit} className="space-y-4">
        {[1, 2, 3].map((priorityNumber) => (
          <div key={priorityNumber} className="relative rounded-lg shadow-sm">
            <div className="relative flex h-10 items-stretch rounded-t-lg bg-[#f7f8dc] pr-4">
              <div className="absolute left-[-6px] top-0 h-10 w-3 rounded-full bg-[#d8cd72]" />
              <div className="flex flex-1 items-center pl-7">
                <p className="text-sm font-semibold text-slate-800">Priority Task {priorityNumber}</p>
              </div>
            </div>
            <div className="rounded-b-lg bg-white px-4 pb-3 pt-2.5 shadow-md">
              <textarea
                required
                rows={1}
                onChange={(e) => handleChange(`priority_${priorityNumber}`, e.target.value)}
                onInput={(e) => {
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                }}
                placeholder="Describe your task…"
                className="w-full resize-none overflow-hidden rounded-md bg-white px-4 py-2 text-sm text-slate-900 placeholder-[#b8ad56] outline-none focus:outline-none"
              />
            </div>
          </div>
        ))}
      </form>
    );
  }

  if (templateKey === "daily_checkout") {
    const statusOptions = [
      { key: "done_100" as const, color: "bg-green-500", label: "100%" },
      { key: "done_50_75" as const, color: "bg-orange-500", label: "50–75%" },
      { key: "less_than_50" as const, color: "bg-red-500", label: "Less than 50%" },
      { key: "deprioritised" as const, color: "bg-blue-500", label: "Deprioritised" },
    ];

    return (
      <>
        {openStatusFor !== null && (
          <button
            className="fixed inset-0 z-40"
            onClick={() => setOpenStatusFor(null)}
            aria-label="Close status menu"
          />
        )}
        <form id="daily-checkin-form" onSubmit={handleFormSubmit} className="space-y-4">
          {[
            { number: 1 },
            { number: 2 },
            { number: 3 },
          ].map(({ number }) => (
            <div key={number} className="relative rounded-lg shadow-sm">
              <div className="flex h-10 items-center">
                <div className="relative flex h-full flex-1 items-center rounded-tl-lg bg-[#d8cd72]/25 pl-7 pr-4">
                  <div className="absolute left-[-6px] top-0 h-10 w-3 rounded-full bg-[#d8cd72]" />
                  <p className="truncate text-sm font-semibold text-slate-800">{`{{Priority Task ${number} Description}}`}</p>
                </div>
                <div className="relative flex h-full w-16 items-center justify-end bg-white pr-4">
                  <button
                    type="button"
                    onClick={() => setOpenStatusFor(openStatusFor === number ? null : (number as 1 | 2 | 3))}
                    className={cx(
                      "h-8 w-8 rounded-full",
                      formData[`status_${number}`]
                        ? checkoutStatusColorByKey[formData[`status_${number}`] as (typeof checkoutStatusKeys)[number]]
                        : "bg-white border border-slate-300"
                    )}
                    aria-label={`Priority ${number} status`}
                  />
                  {openStatusFor === number && (
                    <div className="absolute top-full right-0 z-50 mt-2 w-48 rounded-lg border border-slate-200 bg-white shadow-lg">
                      {statusOptions.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => {
                            handleChange(`status_${number}`, option.key);
                            setOpenStatusFor(null);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-900 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                        >
                          <span className={cx("h-5 w-5 rounded-full", option.color)} />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-b-lg bg-white px-4 pb-3 pt-2.5 shadow-md">
                <textarea
                  rows={1}
                  onChange={(e) => handleChange(`outcome_${number}`, e.target.value)}
                  onInput={(e) => {
                    e.currentTarget.style.height = "auto";
                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                  }}
                  placeholder="Describe the outcome..."
                  className="w-full resize-none overflow-hidden rounded-md bg-white px-4 py-2 text-sm text-slate-900 placeholder-[#b8ad56] outline-none focus:outline-none"
                />
              </div>
            </div>
          ))}
        </form>
      </>
    );
  }

  if (templateKey === "weekly_checkin" || templateKey === "weekly_checkout") {
    const weeklyFields = [
      {
        label: "1.1) Leads created this week?",
        key: "leads_created",
        type: "number" as const,
      },
      {
        label: "1.2) Explain what happened?",
        key: "leads_explanation",
        type: "text" as const,
        placeholder: "Describe what contributed to the above result…",
      },
      {
        label: "2.1) Viewings attended this week?",
        key: "viewings_attended",
        type: "number" as const,
      },
      {
        label: "2.2) Explain what happened?",
        key: "viewings_explanation",
        type: "text" as const,
        placeholder: "Describe what contributed to the above result…",
      },
      {
        label: "3.1) Leases signed this week?",
        key: "leases_signed",
        type: "number" as const,
      },
      {
        label: "3.2) Explain what happened?",
        key: "leases_explanation",
        type: "text" as const,
        placeholder: "Describe what contributed to the above result…",
      },
    ];

    // Map UI fields to clean answer keys
    const answerKeyMap: Record<string, string> = {
      leads_created: "leads_count",
      leads_explanation: "leads_explanation",
      viewings_attended: "viewings_count",
      viewings_explanation: "viewings_explanation",
      leases_signed: "leases_count",
      leases_explanation: "leases_explanation",
    };

    // Map clean keys to readable labels for error banner
    const readableWeeklyLabels: Record<string, string> = {
      leads_count: "Leads created",
      leads_explanation: "Leads explanation",
      viewings_count: "Viewings attended",
      viewings_explanation: "Viewings explanation",
      leases_count: "Leases signed",
      leases_explanation: "Leases explanation"
    };

    const handleWeeklySubmit = (e: React.FormEvent) => {
      e.preventDefault();
      // Build answers_json with correct keys and types
      const answers_json: Record<string, string | number> = {};
      for (const field of weeklyFields) {
        const raw = formData[field.key];
        const mappedKey = answerKeyMap[field.key];
        if (field.type === "number") {
          // Allow empty string while typing, otherwise parseInt
          answers_json[mappedKey] = raw === undefined || raw === "" ? "" : parseInt(raw as string, 10);
        } else {
          answers_json[mappedKey] = typeof raw === "string" ? raw : "";
        }
      }
      // Check for missing required fields using clean keys
      const missingKeys = requiredKeysByTemplate[templateKey] || [];
      const missingFields = missingKeys.filter((k) => {
        const v = answers_json[k];
        if (v === undefined || v === null || v === "") return true;
        return false;
      });
      if (missingFields.length > 0) {
        onSubmit(
          { answers_json },
          missingFields.map((k) => readableWeeklyLabels[k] || k)
        );
        return;
      }
      onSubmit({ answers_json }, []);
    };

    return (
      <form onSubmit={handleWeeklySubmit} className="space-y-6 pb-24">
        {weeklyFields.map((field) => (
          <div key={field.key} className="relative rounded-md bg-white shadow-lg transition-shadow duration-200 hover:shadow-xl">
            <div className="relative flex h-10 items-stretch rounded-t-md bg-[#f7f8dc] pr-4">
              <div className="absolute left-[-6px] top-0 h-10 w-3 rounded-full bg-[#d8cd72]" />
              <div className="flex flex-1 items-center px-4 pl-7">
                <p className="text-sm font-semibold text-slate-800">{field.label}</p>
              </div>
            </div>
            <div className="rounded-b-md bg-white px-4 py-2.5">
              {field.type === "number" ? (
                <input
                  required
                  type="number"
                  placeholder="#"
                  value={getInputValue(field.key)}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="h-10 w-full bg-white px-4 text-xl font-semibold text-slate-900 placeholder:text-xl placeholder:font-semibold placeholder:text-[#b8ad56] outline-none"
                />
              ) : (
                <textarea
                  required
                  rows={2}
                  value={getInputValue(field.key)}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  onInput={(e) => {
                    e.currentTarget.style.height = "auto";
                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                  }}
                  placeholder={field.placeholder}
                  className="w-full resize-none overflow-hidden rounded-md bg-white px-4 py-1 min-h-[32px] text-sm text-slate-900 placeholder:text-sm placeholder:font-medium placeholder-[#b8ad56] outline-none focus:outline-none leading-relaxed"
                />
              )}
            </div>
          </div>
        ))}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-2xl bg-[#2f343a] py-3 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit Check-out"}
        </button>
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
