"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
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

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function Badge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c7c85a] px-1.5 text-[11px] font-semibold text-[#0f172a]">
      {value > 99 ? "99+" : value}
    </span>
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

  const [sidebarOpenDesktop, setSidebarOpenDesktop] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [pendingTaskCount, setPendingTaskCount] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

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

      if (!error && count !== null) {
        setPendingTaskCount(count);
      }
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

  const SidebarContent = (
    <aside
      className={cx(
        "flex h-full flex-col border-r border-slate-900/10 bg-white",
        sidebarOpenDesktop ? "w-80" : "w-20"
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="h-10 w-10 rounded-2xl bg-[#c7c85a]/30" />
        {sidebarOpenDesktop ? (
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">NetworkSpace</p>
            <p className="text-xs text-slate-500">Workspace</p>
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

      {/* Menu */}
      <nav className="px-3">
        {sidebarOpenDesktop ? (
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Menu
          </p>
        ) : null}

        <div className="space-y-1">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/workspace");
            }}
            className={cx(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              "bg-[#c7c85a]/20 text-slate-900"
            )}
          >
            <span className="h-2 w-2 rounded-full bg-[#c7c85a]" />
            {sidebarOpenDesktop ? <span>Workspace</span> : null}
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/tasks");
            }}
            className={cx(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <span className="h-2 w-2 rounded-full bg-slate-200" />
            {sidebarOpenDesktop ? <span>Tasks</span> : null}
            {sidebarOpenDesktop ? <Badge value={pendingTaskCount} /> : null}
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/inbox");
            }}
            className={cx(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <span className="h-2 w-2 rounded-full bg-slate-200" />
            {sidebarOpenDesktop ? <span>Inbox</span> : null}
          </button>
        </div>
      </nav>

      {/* Sessions */}
      <div className="mt-5 px-3">
        {sidebarOpenDesktop ? (
          <div className="flex items-center justify-between px-3 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Chats
            </p>
            <button
              onClick={handleNewChat}
              className="rounded-xl bg-[#2f343a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
            >
              New
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={handleNewChat}
              className="rounded-xl bg-[#2f343a] px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900"
              aria-label="New chat"
            >
              +
            </button>
          </div>
        )}

        {sidebarOpenDesktop ? (
          <div className="mt-2 max-h-[45vh] space-y-2 overflow-y-auto px-2 pb-2">
            {sessions.length === 0 ? (
              <p className="px-2 text-xs text-slate-500">No sessions yet</p>
            ) : (
              sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <button
                    key={session.id}
                    onClick={() => {
                      setActiveSessionId(session.id);
                      void loadHistory(session.id);
                    }}
                    className={cx(
                      "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                      isActive
                        ? "border-[#c7c85a]/40 bg-[#c7c85a]/15 text-slate-900"
                        : "border-slate-900/10 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <p className="truncate font-medium">{session.title || "New chat"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(session.updated_at).toLocaleDateString()}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-slate-900/10 px-5 py-4">
        {sidebarOpenDesktop ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">
                {currentUser?.email ?? "Signed in"}
              </p>
              <p className="text-[11px] text-slate-500">Premium • Familiar • Fast</p>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={handleSignOut}
            className="mx-auto block rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            aria-label="Sign out"
          >
            ⎋
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <main className="min-h-screen bg-white text-slate-900" suppressHydrationWarning>
      {!mounted ? null : (
        <>
          {/* Premium subtle background */}
          <div className="pointer-events-none fixed inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(199,200,90,0.20),transparent_42%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(15,23,42,0.06),transparent_55%)]" />
          </div>

          <div className="relative flex min-h-screen">
            {/* Desktop sidebar */}
            <div className="hidden md:block">{SidebarContent}</div>

            {/* Mobile top bar */}
            <div className="md:hidden fixed left-0 right-0 top-0 z-20 border-b border-slate-900/10 bg-white/90 backdrop-blur">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Menu
                </button>
                <div className="text-sm font-semibold text-slate-900">Workspace</div>
                <button
                  onClick={() => router.push("/tasks")}
                  className="relative rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Tasks
                  {pendingTaskCount > 0 ? (
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c7c85a] px-1.5 text-[11px] font-semibold text-[#0f172a]">
                      {pendingTaskCount > 99 ? "99+" : pendingTaskCount}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            {/* Mobile drawer */}
            {mobileMenuOpen ? (
              <div className="md:hidden fixed inset-0 z-30">
                <div className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
                <div className="absolute inset-y-0 left-0">
                  {/* Force sidebar open on mobile for usability */}
                  <div className="h-full w-80">{SidebarContent}</div>
                </div>
              </div>
            ) : null}

            {/* Main content */}
            <section className="flex-1 px-5 pb-6 pt-20 md:px-10 md:pt-8">
              {/* Header (desktop) */}
              <div className="mb-6 hidden md:flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-slate-900">Workspace</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Ask the assistant, review context, and keep moving.
                  </p>
                </div>

                <button
                  onClick={() => router.push("/tasks")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-900/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Open Tasks
                  <span className="inline-flex items-center justify-center rounded-full bg-[#c7c85a]/30 px-2 py-0.5 text-xs font-semibold text-slate-900">
                    {pendingTaskCount}
                  </span>
                </button>
              </div>

              {/* Chat container */}
              <div className="mx-auto w-full max-w-4xl">
                <div className="rounded-3xl border border-slate-900/10 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
                  {/* Chat header strip */}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-6 py-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Assistant
                      </p>
                      <h2 className="mt-1 truncate text-base font-semibold text-slate-900">
                        Workspace Assistant
                      </h2>
                    </div>

                    <button
                      onClick={handleNewChat}
                      className="rounded-2xl bg-[#2f343a] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                    >
                      New chat
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="h-[60vh] overflow-y-auto px-6 py-5 md:h-[62vh]">
                    <div className="space-y-4">
                      {messages.length === 0 ? (
                        <div className="rounded-2xl border border-slate-900/10 bg-slate-50 p-5">
                          <p className="text-sm font-semibold text-slate-900">You’re in.</p>
                          <p className="mt-1 text-sm text-slate-600">
                            Ask anything operational — or open Tasks to complete check-ins.
                          </p>
                        </div>
                      ) : null}

                      {messages.map((msg) => {
                        const isUser = msg.role === "user";
                        return (
                          <div key={msg.id} className={cx("flex", isUser ? "justify-end" : "justify-start")}>
                            <div
                              className={cx(
                                "max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-relaxed",
                                isUser
                                  ? "border-[#c7c85a]/40 bg-[#c7c85a]/15 text-slate-900"
                                  : "border-slate-900/10 bg-white text-slate-900"
                              )}
                            >
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Input */}
                  <div className="border-t border-slate-900/10 px-6 py-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSendMessage(input);
                          }
                        }}
                        placeholder="Type your message…"
                        className="flex-1 rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-[#c7c85a]/50 focus:outline-none focus:ring-2 focus:ring-[#c7c85a]/25"
                      />
                      <button
                        onClick={() => handleSendMessage(input)}
                        className="rounded-2xl bg-[#2f343a] px-5 py-3 text-sm font-semibold text-white hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c7c85a]/25 disabled:opacity-60"
                        disabled={isLoading}
                      >
                        {isLoading ? "Sending…" : "Send"}
                      </button>
                    </div>

                    {status ? <p className="mt-2 text-sm text-slate-600">{status}</p> : null}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
