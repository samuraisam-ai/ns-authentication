"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function WorkspaceClient({ user: initialUser }: Props) {
  const router = useRouter();
  const pathname = usePathname();
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

      if (!error && count !== null) setPendingTaskCount(count);
    } catch (err) {
      console.error("Failed to fetch pending task count:", err);
    }
  }

  async function loadSessions(options?: { selectFirstIfEmpty?: boolean; preferredSessionId?: string }) {
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
    router.push("/");
  }

  async function handleSendMessage(message: string) {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message,
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

      if (!activeSessionId && nextSessionId) setActiveSessionId(nextSessionId);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: botReply,
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
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const navItems = [
    { href: "/workspace", label: "Workspace", badge: null },
    { href: "/tasks", label: "Tasks", badge: pendingTaskCount > 0 ? pendingTaskCount : null },
    { href: "/inbox", label: "Inbox", badge: null },
  ];

  return (
    <main className="min-h-screen bg-[var(--ns-surface)] text-[var(--ns-charcoal)]" suppressHydrationWarning>
      {!mounted ? null : (
        <>
          {/* Subtle NetworkSpace-inspired backdrop */}
          <div className="pointer-events-none fixed inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(199,199,74,0.18),transparent_40%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_35%,rgba(17,24,39,0.08),transparent_45%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(17,24,39,0.02),transparent_25%,rgba(17,24,39,0.03))]" />
          </div>

          <div className="relative mx-auto min-h-screen w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">
            {/* Top bar */}
            <header className="flex items-center justify-between rounded-2xl border border-[var(--ns-border)] bg-white/70 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen((v) => !v)}
                  className="inline-flex items-center rounded-xl border border-[var(--ns-border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--ns-muted)]"
                >
                  {sidebarOpen ? "Menu" : "Menu"}
                </button>
                <div className="leading-tight">
                  <div className="text-sm font-semibold">Workspace</div>
                  <div className="text-xs text-slate-500">NetworkSpace AI Check-ins</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center rounded-xl bg-[var(--ns-charcoal)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                >
                  Sign out
                </button>
              </div>
            </header>

            {/* Shell */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
              {/* Side menu */}
              <aside
                className={classNames(
                  "rounded-2xl border border-[var(--ns-border)] bg-white/70 p-3 backdrop-blur",
                  sidebarOpen ? "" : "md:opacity-100"
                )}
              >
                <div className="flex items-center justify-between px-2 pb-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Navigation
                  </div>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={classNames(
                          "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition",
                          active
                            ? "bg-[var(--ns-olive-soft)] text-[var(--ns-charcoal)]"
                            : "text-slate-700 hover:bg-[var(--ns-muted)]"
                        )}
                      >
                        <span>{item.label}</span>
                        {item.badge ? (
                          <span className="rounded-full bg-[var(--ns-charcoal)] px-2 py-0.5 text-xs font-bold text-white">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>

                <div className="mt-4 rounded-xl border border-[var(--ns-border)] bg-white px-3 py-3">
                  <div className="text-xs font-semibold text-slate-600">Today</div>
                  <div className="mt-1 text-sm">
                    {pendingTaskCount > 0 ? (
                      <span>
                        <span className="font-bold">{pendingTaskCount}</span> task(s) need attention
                      </span>
                    ) : (
                      <span className="text-slate-600">No pending tasks</span>
                    )}
                  </div>
                  <Link
                    href="/tasks"
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[var(--ns-border)] bg-[var(--ns-muted)] px-3 py-2 text-sm font-semibold hover:bg-white"
                  >
                    View tasks
                  </Link>
                </div>

                <div className="mt-4">
                  <button
                    onClick={handleNewChat}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--ns-olive)] px-4 py-2 text-sm font-bold text-[var(--ns-charcoal)] hover:opacity-95"
                  >
                    New chat
                  </button>
                </div>
              </aside>

              {/* Main chat */}
              <section className="rounded-2xl border border-[var(--ns-border)] bg-white/70 backdrop-blur">
                <div className="border-b border-[var(--ns-border)] px-4 py-3">
                  <div className="text-sm font-semibold">Chat</div>
                  <div className="text-xs text-slate-500">
                    Keep it simple. Use chat to guide your day, then complete tasks.
                  </div>
                </div>

                <div className="flex h-[calc(100vh-220px)] flex-col">
                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    {status ? (
                      <div className="mb-3 rounded-xl border border-[var(--ns-border)] bg-white px-3 py-2 text-sm text-slate-700">
                        {status}
                      </div>
                    ) : null}

                    {messages.length === 0 ? (
                      <div className="rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-4 text-sm text-slate-700">
                        <div className="font-semibold">Welcome.</div>
                        <div className="mt-1 text-slate-600">
                          Ask the assistant what you should focus on today, then complete your check-ins from Tasks.
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={classNames(
                            "max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                            m.role === "user"
                              ? "ml-auto bg-[var(--ns-charcoal)] text-white"
                              : "mr-auto bg-white text-slate-800 border border-[var(--ns-border)]"
                          )}
                        >
                          {m.content}
                        </div>
                      ))}
                      {isLoading ? (
                        <div className="mr-auto max-w-[70%] rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-3 text-sm text-slate-600">
                          Thinking…
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="border-t border-[var(--ns-border)] px-4 py-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSendMessage(input);
                      }}
                      className="flex items-end gap-2"
                    >
                      <div className="flex-1">
                        <label className="sr-only" htmlFor="chatInput">
                          Message
                        </label>
                        <textarea
                          id="chatInput"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          rows={2}
                          placeholder="Type your message…"
                          className="w-full resize-none rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className={classNames(
                          "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold",
                          isLoading || !input.trim()
                            ? "bg-slate-200 text-slate-500"
                            : "bg-[var(--ns-olive)] text-[var(--ns-charcoal)] hover:opacity-95"
                        )}
                      >
                        Send
                      </button>
                    </form>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </main>
  );
}