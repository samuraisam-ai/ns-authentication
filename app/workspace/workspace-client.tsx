"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useRouter, useSearchParams } from "next/navigation";
import { MENU_BUBBLE_BUTTON, MENU_EXPANDABLE_BUTTON } from "@/lib/menu-styles";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppMenu from "@/app/components/AppMenu";

type Props = { user: User | null };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  isTyping?: boolean;
  fullText?: string;
  displayText?: string;
  reply?: string;
};

type Session = {
  id: string;
  title: string;
  updated_at: string;
};

type PendingTask = {
  id: string;
  scheduled_for: string;
  template_key: string | null;
  template_title: string | null;
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function Badge({ value }: { value: number }) {
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c7c85a] px-1.5 text-[11px] font-semibold text-[#0f172a]">
      {value > 99 ? "99+" : value}
    </span>
  );
}

export default function WorkspaceClient({ user: initialUser }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newChatParam = searchParams.get("newChat") === "1";
  const sessionIdParam = searchParams.get("sessionId");
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [mounted, setMounted] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [sidebarOpenDesktop, setSidebarOpenDesktop] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingTaskCount, setPendingTaskCount] = useState(0);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const forceNewChatRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!newChatParam && !forceNewChatRef.current) return;
    setActiveSessionId(null);
    setMessages([]);
    try {
      localStorage.removeItem("activeSessionId");
    } catch {}
    forceNewChatRef.current = false;
  }, [newChatParam]);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (newChatParam || forceNewChatRef.current) return;
    if (!sessionIdParam) return;

    setActiveSessionId(sessionIdParam);
    void loadHistory(sessionIdParam);
  }, [currentUser?.id, newChatParam, sessionIdParam]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (forceNewChatRef.current) return;

    if (!currentUser) {
      setSessions([]);
      setSessionsLoading(false);
      setActiveSessionId(null);
      setMessages([]);
      setPendingTaskCount(0);
      return;
    }

    if (!newChatParam && !forceNewChatRef.current) {
      void loadSessions({ selectFirstIfEmpty: true, preferredSessionId: sessionIdParam ?? undefined });
    }
    void fetchPendingTaskCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, newChatParam, sessionIdParam]);

  useEffect(() => {
    if (!currentUser?.id) return;

    void fetchPendingCount();

    const channel = supabase
      .channel("pending-tasks-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checkin_tasks",
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          void fetchPendingCount();
        }
      )
      .subscribe();

    const pollingInterval = setInterval(() => {
      void fetchPendingCount();
    }, 30000);

    return () => {
      clearInterval(pollingInterval);
      void supabase.removeChannel(channel);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    void fetchSessions();

    const interval = setInterval(() => {
      void fetchSessions();
    }, 15000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    if (!currentUser?.id) return;
    void fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileMenuOpen, currentUser?.id]);

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, []);

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

  async function fetchPendingCount() {
    if (!currentUser?.id) {
      setPendingCount(0);
      setPendingTasks([]);
      return;
    }

    try {
      const { count } = await supabase
        .from("checkin_tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", currentUser.id)
        .eq("status", "pending");

      setPendingCount(count ?? 0);

      const { data: taskRows } = await supabase
        .from("checkin_tasks")
        .select(
          `
          id,
          scheduled_for,
          period_key,
          template:checkin_templates(template_key, title)
        `
        )
        .eq("user_id", currentUser.id)
        .eq("status", "pending")
        .order("scheduled_for", { ascending: true })
        .limit(20);

      const mappedTasks: PendingTask[] = (taskRows ?? []).map((row: Record<string, unknown>) => {
        const template =
          row.template && typeof row.template === "object"
            ? (row.template as Record<string, unknown>)
            : undefined;

        const id = typeof row.id === "string" ? row.id : "";
        const scheduled_for = typeof row.scheduled_for === "string" ? row.scheduled_for : "";
        const template_key =
          typeof template?.template_key === "string"
            ? template.template_key
            : typeof row.period_key === "string"
              ? row.period_key
              : null;
        const template_title = typeof template?.title === "string" ? template.title : null;

        return {
          id,
          scheduled_for,
          template_key,
          template_title,
        };
      });

      setPendingTasks(mappedTasks);
    } catch {
      setPendingCount(0);
      setPendingTasks([]);
    }
  }

  async function fetchSessions() {
    if (!currentUser?.id) {
      setSessions([]);
      setSessionsLoading(false);
      return;
    }

    setSessionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, updated_at, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSessions((data ?? []) as Session[]);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
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
    setHistoryLoading(true);
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
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSignOut() {
    setStatus("");
    const { error } = await supabase.auth.signOut();
    if (error) setStatus(`Error: ${error.message}`);
  }

  async function handleSendMessage(messageText: string) {
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText, sessionId: activeSessionId ?? undefined }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Webhook failed (${res.status}): ${errText}`);
      }

      const data = (await res.json()) as { reply?: string; sessionId?: string };
      const assistantText = String(data.reply ?? "No reply returned");
      const nextSessionId = data.sessionId ?? activeSessionId;

      if (!activeSessionId && nextSessionId) setActiveSessionId(nextSessionId);

      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
        setMessages((prev) =>
          prev.map((item) =>
            item.role === "assistant" && item.isTyping
              ? {
                  ...item,
                  isTyping: false,
                  content: item.fullText ?? item.displayText ?? item.content,
                  displayText: item.fullText ?? item.displayText ?? item.content,
                }
              : item
          )
        );
      }

      const botMessageId = (Date.now() + 1).toString();
      const botMessage: Message = {
        id: botMessageId,
        role: "assistant",
        content: "",
        fullText: assistantText,
        displayText: "",
        isTyping: true,
        reply: data.reply,
      };

      setMessages((prev) => [...prev, botMessage]);

      const TYPING_MS_PER_WORD = 110;
      const words = assistantText.split(" ");
      let index = 0;

      const getPauseForWord = (word: string) => {
        if (/[.!?]$/.test(word)) return 220;
        if (/[,:;]$/.test(word)) return 120;
        return 0;
      };

      const typeNextWord = () => {
        index += 1;
        const nextDisplayText = words.slice(0, index).join(" ");
        const done = index >= words.length;

        setMessages((prev) =>
          prev.map((item) =>
            item.id === botMessageId
              ? {
                  ...item,
                  displayText: nextDisplayText,
                  content: done ? assistantText : item.content,
                  isTyping: !done,
                }
              : item
          )
        );

        if (done) {
          typingIntervalRef.current = null;
          return;
        }

        const currentWord = words[index - 1] ?? "";
        const nextDelay = TYPING_MS_PER_WORD + getPauseForWord(currentWord);
        typingIntervalRef.current = setTimeout(typeNextWord, nextDelay);
      };

      typingIntervalRef.current = setTimeout(typeNextWord, TYPING_MS_PER_WORD);

      await loadSessions({ preferredSessionId: nextSessionId ?? activeSessionId ?? undefined });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: `Connection error talking to AI. ${errorMessage}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleNewChat(): Promise<string | null> {
    setStatus("");
    try {
      const res = await fetch("/api/chat/session", { method: "POST" });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Failed to create session (${res.status}): ${errText}`);
      }
      const data = (await res.json()) as { sessionId: string };
      const newId = data.sessionId;
      setActiveSessionId(newId);
      setSessions((prev) => [
        { id: newId, title: "New chat", updated_at: new Date().toISOString() },
        ...prev,
      ]);
      setMessages([]);
      return newId;
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  function handleComposerInput(value: string) {
    setMessage(value);
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }

  function sendMessage() {
    const nextMessage = message.trim();
    if (!nextMessage) return;

    void handleSendMessage(nextMessage);

    setMessage("");
    const textarea = textareaRef.current;
    if (textarea) textarea.style.height = "auto";
  }

  const handleNewChatClick = async () => {
    forceNewChatRef.current = true;
    setActiveSessionId(null);
    setMessages([]);
    try {
      localStorage.removeItem("activeSessionId");
    } catch {}
    try {
      await handleNewChat();
      router.replace("/workspace");
    } finally {
      forceNewChatRef.current = false;
    }
  };

  const SidebarContent = (
    <aside className="fixed inset-0 z-50 flex h-full flex-col bg-white">
      <AppMenu
        onClose={() => setMobileMenuOpen(false)}
        onNewChat={handleNewChatClick}
      />

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

  return (
    <main className="min-h-screen bg-[#eaeaea] text-slate-900" suppressHydrationWarning>
      {!mounted ? null : (
        <>
          <header className="relative z-20 mx-auto flex w-full max-w-[420px] items-center justify-between bg-white px-6 pt-6 pb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => router.push("/tasks")}
                  aria-label="Go to tasks"
                >
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
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex items-center justify-center"
              aria-label="Open menu"
            >
              <span className="flex flex-col gap-1">
                <span className="block h-[2px] w-6 bg-[#d8cd72]" />
                <span className="block h-[2px] w-6 bg-[#d8cd72]" />
                <span className="block h-[2px] w-6 bg-[#d8cd72]" />
              </span>
            </button>
          </header>

          {mobileMenuOpen ? SidebarContent : null}

          <section className="mx-auto w-full max-w-[420px] px-6">
            {messages.length === 0 && !historyLoading ? (
              <div className="flex h-[calc(100vh-160px)] items-center justify-center text-center">
                <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Ready to help you improve.</h1>
              </div>
            ) : historyLoading ? (
              <div className="h-[calc(100vh-220px)] overflow-y-auto pb-40 pt-6">
                <div className="space-y-3">
                  {[1, 2, 3].map((index) => (
                    <div key={index} className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl bg-slate-200 px-4 py-3 animate-pulse">
                        <div className="h-4 w-24 bg-slate-300 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[calc(100vh-220px)] overflow-y-auto pb-40 pt-6">
                <div className="space-y-3">
                  {messages.map((item) => (
                    <div
                      key={item.id}
                      className={cx("flex", item.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cx(
                          "max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-6",
                          item.role === "user" ? "bg-[#d8cd72] text-slate-900" : "bg-white text-slate-800"
                        )}
                      >
                        {item.role === "assistant" && item.isTyping ? (
                          item.displayText ?? ""
                        ) : item.role === "assistant" ? (
                          <div
                            className="
                              prose prose-sm max-w-none text-slate-900 leading-relaxed
                              prose-headings:mt-4 prose-headings:mb-2
                              prose-p:my-2
                              prose-ul:my-2 prose-ul:pl-5 prose-ul:list-disc
                              prose-ol:my-2 prose-ol:pl-5 prose-ol:list-decimal
                              prose-li:my-1
                              prose-strong:font-semibold
                              prose-headings:text-slate-900
                            "
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {String(item.reply ?? item.content ?? "")}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          item.content
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="pointer-events-auto fixed inset-x-0 bottom-6 z-30 px-6">
            <div className="pointer-events-auto mx-auto w-full max-w-[420px] rounded-3xl bg-white p-3 shadow-sm">
              <div className="flex items-end gap-3">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => handleComposerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  rows={1}
                  placeholder="Ask anything..."
                  className="min-h-[44px] max-h-40 w-full flex-1 resize-none overflow-y-auto rounded-2xl bg-white px-4 py-3 text-sm leading-5 text-slate-900 caret-slate-900 placeholder:text-slate-400 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={sendMessage}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d8cd72]"
                  aria-label="Send message"
                >
                  <img
                    src="https://res.cloudinary.com/dtjysgyny/image/upload/v1772018519/up_arrow_icon_transparent_anehfo.png"
                    alt="Send"
                    className="h-5 w-5 object-contain"
                  />
                </button>
              </div>
            </div>
          </div>

          {status ? <p className="sr-only">{status}</p> : null}
        </>
      )}
    </main>
  );
}
