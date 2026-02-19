"use client";

import { useEffect, useMemo, useState } from "react";
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

      if (preferredId) {
        return;
      }

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
      const data = (await res.json()) as {
        messages?: Message[];
      };
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
        headers: {
          "Content-Type": "application/json",
        },
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

  return (
    <main className="min-h-screen bg-white text-slate-900" suppressHydrationWarning>
      {!mounted ? null : (
        <>
          {/* subtle futuristic background */}
          <div className="pointer-events-none fixed inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(16,185,129,0.14),transparent_35%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_40%,rgba(2,6,23,0.08),transparent_45%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.02),transparent_30%,rgba(2,6,23,0.02))]" />
          </div>

          <div className="relative mx-auto h-screen w-full max-w-6xl px-6 py-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-900/10 pb-4">
              <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">
                ← Back to Home
              </Link>
              <h1 className="text-2xl font-semibold">Workspace</h1>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>

            {/* Main Workspace */}
            <div className="mt-4 flex h-[calc(100vh-120px)] gap-6">
              {/* Sidebar */}
              <div
                className={`rounded-2xl border border-slate-900/10 bg-slate-50 p-4 transition-all duration-200 ${
                  sidebarOpen ? "w-72" : "w-16"
                }`}
              >
                <div className="flex items-center justify-between">
                  {sidebarOpen ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Sessions
                    </p>
                  ) : null}
                  <button
                    onClick={() => setSidebarOpen((prev) => !prev)}
                    className="rounded-full border border-slate-900/10 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {sidebarOpen ? "Collapse" : "Expand"}
                  </button>
                </div>

                {sidebarOpen ? (
                  <>
                    <button
                      onClick={handleNewChat}
                      className="mt-3 w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
                    >
                      New Chat
                    </button>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Tasks
                      </p>
                      <button
                        onClick={() => router.push("/tasks")}
                        className="relative mt-3 w-full rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                      >
                        <span className="font-medium">Tasks</span>
                        {pendingTaskCount > 0 && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                            {pendingTaskCount}
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Chats
                      </p>
                      <div className="mt-3 space-y-2">
                        {sessions.length === 0 ? (
                          <p className="text-xs text-slate-500">No sessions yet</p>
                        ) : (
                          sessions.map((session) => (
                            <button
                              key={session.id}
                              onClick={() => {
                                setActiveSessionId(session.id);
                                void loadHistory(session.id);
                              }}
                              className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                                session.id === activeSessionId
                                  ? "bg-emerald-500 text-white"
                                  : "border border-slate-900/10 bg-white text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              <p className="truncate font-medium">{session.title || "New chat"}</p>
                              <p className="mt-1 text-xs opacity-70">
                                {new Date(session.updated_at).toLocaleDateString()}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Chat Area */}
              <div className="flex-1 rounded-2xl border border-slate-900/10 bg-white p-6 shadow-sm">
                <div className="flex h-full flex-col">
                  <div className="mb-4 border-b border-slate-900/10 pb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Chat
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-slate-900">Workspace Assistant</h2>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 space-y-4 overflow-y-auto">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${
                            msg.role === "user"
                              ? "bg-emerald-500 text-white"
                              : "border border-slate-900/10 bg-slate-50 text-slate-900"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Input */}
                  <div className="mt-4 border-t border-slate-900/10 pt-4">
                    <div className="flex gap-2">
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
                        placeholder="Type a message..."
                        className="flex-1 rounded-full border border-slate-900/10 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button
                        onClick={() => handleSendMessage(input)}
                        className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        disabled={isLoading}
                      >
                        Send
                      </button>
                    </div>
                    {status ? <p className="mt-2 text-sm text-slate-600">{status}</p> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
