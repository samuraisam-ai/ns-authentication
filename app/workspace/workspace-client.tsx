"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = { user: User | null };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type Session = {
  id: string;
  title: string;
  updated_at: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatTime(ts?: string) {
  if (!ts) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "olive" | "danger";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1",
        tone === "neutral" && "bg-white text-slate-700 ring-slate-200",
        tone === "olive" && "bg-[#B8BE3B]/15 text-slate-900 ring-[#B8BE3B]/35",
        tone === "danger" && "bg-red-50 text-red-700 ring-red-200"
      )}
    >
      {children}
    </span>
  );
}

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

export default function WorkspaceClient({ user: initialUser }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pendingTaskCount, setPendingTaskCount] = useState(0);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastBody, setToastBody] = useState<string | undefined>(undefined);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!currentUser) {
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
      setPendingTaskCount(0);
      return;
    }
    void loadSessions({ selectFirstIfEmpty: true });
    void fetchPendingTaskCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    // auto scroll to bottom on new messages
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  function showToast(title: string, body?: string) {
    setToastTitle(title);
    setToastBody(body);
    setToastOpen(true);
    window.setTimeout(() => setToastOpen(false), 2600);
  }

  async function fetchPendingTaskCount() {
    if (!currentUser?.id) {
      setPendingTaskCount(0);
      return;
    }

    try {
      const { count, error } = await supabase
        .from("checkin_tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", currentUser.id)
        .in("status", ["pending", "overdue"]);

      if (!error && count !== null) {
        setPendingTaskCount(count);
      }
    } catch (err) {
      console.error("Failed to fetch pending task count:", err);
    }
  }

  async function loadSessions(options?: {
    selectFirstIfEmpty?: boolean;
    preferredSessionId?: string;
  }) {
    setStatus("");
    try {
      const res = await fetch("/api/chat/sessions");
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Failed to load sessions (${res.status}): ${errText}`);
      }
      const data = (await res.json()) as { sessions?: Session[] };
      const nextSessions = data.sessions ?? [];
      setSessions(nextSessions);

      const preferredId = options?.preferredSessionId ?? activeSessionId;

      if (preferredId) return;

      if (options?.selectFirstIfEmpty && nextSessions[0]) {
        setActiveSessionId(nextSessions[0].id);
        await loadHistory(nextSessions[0].id);
      } else if (nextSessions.length === 0) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function loadHistory(sessionId: string) {
    setStatus("");
    try {
      const res = await fetch(`/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Failed to load history (${res.status}): ${errText}`);
      }
      const data = (await res.json()) as { messages?: Message[] };
      setMessages(data.messages ?? []);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleSignOut() {
    setStatus("");
    const { error } = await supabase.auth.signOut();
    if (error) setStatus(`Error: ${error.message}`);
    else router.replace("/email-password");
  }

  async function handleSendMessage(message: string) {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: activeSessionId ?? undefined }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Webhook failed (${res.status}): ${errText}`);
      }

      const data = (await res.json()) as { reply?: string; sessionId?: string };
      const botReply = String(data.reply ?? "No reply returned");
      const nextSessionId = data.sessionId ?? activeSessionId;

      if (!activeSessionId && nextSessionId) {
        setActiveSessionId(nextSessionId);
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: botReply,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, botMessage]);
      await loadSessions({ preferredSessionId: nextSessionId ?? activeSessionId ?? undefined });
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: `Connection error talking to AI. ${String(err?.message ?? err)}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleNewChat() {
    setStatus("");
    try {
      const res = await fetch("/api/chat/session", { method: "POST" });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Failed to create session (${res.status}): ${errText}`);
      }
      const data = (await res.json()) as { sessionId: string };
      setActiveSessionId(data.sessionId);
      setSessions((prev) => [
        { id: data.sessionId, title: "New chat", updated_at: new Date().toISOString() },
        ...prev,
      ]);
      setMessages([]);
      showToast("New chat created");
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!mounted) return null;

  return (
    <main className="min-h-dvh bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* Brand-ish background (subtle, not loud) */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(184,190,59,0.18),transparent_35%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_25%,rgba(2,6,23,0.06),transparent_42%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.02),transparent_30%,rgba(2,6,23,0.02))]" />
      </div>

      <Toast
        open={toastOpen}
        title={toastTitle}
        body={toastBody}
        onClose={() => setToastOpen(false)}
      />

      <div className="relative mx-auto w-full max-w-6xl px-3 sm:px-6 py-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-900/10 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 md:hidden"
            >
              Menu
            </button>
            <Link href="/" className="hidden sm:block text-sm font-medium text-slate-500 hover:text-slate-800">
              ← Home
            </Link>
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-slate-900" />
              <div className="leading-tight">
                <div className="text-sm font-semibold">NetworkSpace</div>
                <div className="text-xs text-slate-500">AI Check-Ins</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Pill tone="olive">Premium • Familiar • Fast</Pill>
            <button
              onClick={() => router.push("/tasks")}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              title="View tasks"
            >
              Tasks
              {pendingTaskCount > 0 ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[#B8BE3B] px-1.5 py-0.5 text-[11px] font-bold text-slate-900">
                  {pendingTaskCount}
                </span>
              ) : null}
            </button>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-12 gap-4">
          {/* Sidebar */}
          <aside className={cx("col-span-12 md:col-span-3", sidebarOpen ? "" : "hidden md:block")}>
            <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-slate-200 backdrop-blur">
              <div className="px-1 pb-2 text-xs font-semibold tracking-wide text-slate-500">
                MENU
              </div>

              <nav className="space-y-1">
                <Link
                  href="/workspace"
                  className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#B8BE3B]" />
                    Workspace
                  </span>
                  <span className="text-white/60 text-xs">Chat</span>
                </Link>

                <Link
                  href="/tasks"
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    Tasks
                  </span>
                  {pendingTaskCount > 0 ? (
                    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[#B8BE3B] px-1.5 py-0.5 text-[11px] font-bold text-slate-900">
                      {pendingTaskCount}
                    </span>
                  ) : null}
                </Link>

                <Link
                  href="/inbox"
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    Inbox
                  </span>
                  <span className="text-xs text-slate-500">Tab</span>
                </Link>
              </nav>

              {/* Sessions */}
              <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold tracking-wide text-slate-500">CHATS</div>
                  <button
                    onClick={handleNewChat}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    New
                  </button>
                </div>

                <div className="mt-3 space-y-1">
                  {sessions.length === 0 ? (
                    <div className="rounded-xl bg-white p-3 text-sm text-slate-600 ring-1 ring-slate-200">
                      No chats yet.
                    </div>
                  ) : (
                    sessions.map((s) => {
                      const active = s.id === activeSessionId;
                      return (
                        <button
                          key={s.id}
                          onClick={async () => {
                            setActiveSessionId(s.id);
                            await loadHistory(s.id);
                          }}
                          className={cx(
                            "w-full rounded-xl p-3 text-left ring-1 transition",
                            active
                              ? "bg-white ring-[#B8BE3B]/50"
                              : "bg-white/70 ring-slate-200 hover:bg-white"
                          )}
                        >
                          <div className="text-sm font-semibold text-slate-900 line-clamp-1">
                            {s.title || "Chat"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Updated {new Date(s.updated_at).toLocaleDateString()}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Main */}
          <section className="col-span-12 md:col-span-9">
            <div className="rounded-2xl bg-white p-4 sm:p-6 ring-1 ring-slate-200 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-lg sm:text-xl font-semibold">Workspace</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Your main hub. Ask NS AI, review tasks, and submit check-ins.
                  </p>
                </div>
                {pendingTaskCount > 0 ? (
                  <Pill tone="olive">{pendingTaskCount} task(s) need attention</Pill>
                ) : (
                  <Pill>All caught up</Pill>
                )}
              </div>

              {status ? (
                <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
                  {status}
                </div>
              ) : null}

              {/* Chat panel */}
              <div className="mt-5 rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                <div
                  ref={listRef}
                  className="max-h-[55dvh] overflow-auto p-4 sm:p-5 space-y-3"
                >
                  {messages.length === 0 ? (
                    <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                      Start by asking: <span className="font-semibold text-slate-900">“What do I need to do today?”</span>
                    </div>
                  ) : null}

                  {messages.map((m) => {
                    const isUser = m.role === "user";
                    return (
                      <div
                        key={m.id}
                        className={cx("flex", isUser ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cx(
                            "max-w-[88%] rounded-2xl p-3 ring-1",
                            isUser
                              ? "bg-slate-900 text-white ring-white/10"
                              : "bg-white text-slate-900 ring-slate-200"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className={cx("text-xs font-semibold", isUser ? "text-white/70" : "text-slate-500")}>
                              {isUser ? "You" : "NS AI"}
                            </div>
                            <div className={cx("text-[11px]", isUser ? "text-white/50" : "text-slate-400")}>
                              {formatTime(m.created_at)}
                            </div>
                          </div>
                          <div className={cx("mt-1 text-sm leading-relaxed", isUser ? "text-white" : "text-slate-800")}>
                            {m.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isLoading ? (
                    <div className="rounded-2xl bg-white p-3 text-sm text-slate-600 ring-1 ring-slate-200">
                      Thinking…
                    </div>
                  ) : null}
                </div>

                {/* Composer */}
                <div className="border-t border-slate-200 p-3 sm:p-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSendMessage(input);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask NS AI…"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      className={cx(
                        "rounded-xl px-4 py-3 text-sm font-semibold text-white",
                        isLoading || !input.trim()
                          ? "bg-slate-400"
                          : "bg-slate-900 hover:bg-slate-800"
                      )}
                      onClick={() => {
                        // subtle nudge on send
                        if (input.trim()) showToast("Message sent");
                      }}
                    >
                      Send
                    </button>
                  </form>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setInput("What do I need to do today?")}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      Today’s tasks
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/tasks")}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      Open tasks
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/inbox")}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      Inbox
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
