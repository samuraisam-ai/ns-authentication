"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useRouter } from "next/navigation";

type Props = { user: User | null };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  isTyping?: boolean;
  fullText?: string;
  displayText?: string;
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
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [mounted, setMounted] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [sidebarOpenDesktop, setSidebarOpenDesktop] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingTaskCount, setPendingTaskCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!currentUser?.id) return;

    try {
      const { count } = await supabase
        .from("checkin_tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", currentUser.id)
        .eq("status", "pending");

      setPendingCount(count ?? 0);
    } catch {
      setPendingCount(0);
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

  const SidebarContent = (
    <aside className="flex h-full w-[80vw] max-w-sm flex-col bg-white shadow-[0_24px_60px_rgba(15,23,42,0.20)]">
      <div className="flex items-center justify-between border-b border-slate-900/10 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Menu</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">Dashboard</p>
        </div>
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-lg font-semibold text-[#d8cd72] hover:bg-slate-50"
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      <nav className="px-4 py-4">
        <div className="space-y-2">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/workspace");
            }}
            className="flex w-full items-center rounded-2xl bg-[#d8cd72]/25 px-4 py-3 text-left text-sm font-semibold text-slate-900"
          >
            Dashboard
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/tasks");
            }}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <span>Tasks</span>
            <Badge value={pendingTaskCount} />
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/inbox");
            }}
            className="flex w-full items-center rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Chats
          </button>
        </div>
      </nav>

      <div className="mt-auto border-t border-slate-900/10 px-4 py-4">
        <button
          onClick={handleSignOut}
          className="w-full rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900" suppressHydrationWarning>
      {!mounted ? null : (
        <>
          <header className="relative z-20 mx-auto flex w-full max-w-[420px] items-center justify-between px-6 pt-6">
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

          {mobileMenuOpen ? (
            <div className="fixed inset-0 z-40">
              <div className="absolute inset-0 bg-black/35" onClick={() => setMobileMenuOpen(false)} />
              <div className="absolute inset-y-0 left-0">{SidebarContent}</div>
            </div>
          ) : null}

          <section className="mx-auto h-[calc(100vh-220px)] w-full max-w-[420px] overflow-y-auto px-6 pb-40 pt-6">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Ready to help you improve.</h1>
              </div>
            ) : (
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
                      {item.role === "assistant" && item.isTyping ? item.displayText ?? "" : item.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="pointer-events-auto fixed inset-x-0 bottom-6 z-30 px-6">
            <div className="pointer-events-auto mx-auto w-full max-w-[420px] rounded-3xl bg-[#545454] p-3">
              <div>
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
                  placeholder="Ask anything"
                  className="pointer-events-auto mt-1 max-h-40 min-h-[24px] w-full resize-none overflow-y-auto bg-transparent text-sm leading-5 text-white caret-white placeholder:text-slate-300/60 focus:outline-none"
                />
              </div>

              <div className="mt-1 flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-semibold text-white"
                  aria-label="Add"
                >
                  +
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-300/25"
                    aria-label="Voice input"
                  >
                    <img
                      src="https://res.cloudinary.com/dtjysgyny/image/upload/v1772018518/microphone_icon_transparent_lx4gyi.png"
                      alt="Microphone"
                      className="h-5 w-5 object-contain"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={sendMessage}
                    className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d8cd72]"
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
          </div>

          {status ? <p className="sr-only">{status}</p> : null}
        </>
      )}
    </main>
  );
}
