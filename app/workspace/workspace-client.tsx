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
    <main className="min-h-screen bg-white text-slate-900" suppressHydrationWarning>
      {!mounted ? null : (
        <>
          <div className="pointer-events-none fixed inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(216,205,114,0.22),transparent_42%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(15,23,42,0.06),transparent_55%)]" />
          </div>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="fixed left-5 top-5 z-30 rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-xl font-semibold text-[#d8cd72] shadow-sm hover:bg-slate-50"
            aria-label="Open menu"
          >
            ☰
          </button>

          {mobileMenuOpen ? (
            <div className="fixed inset-0 z-40">
              <div className="absolute inset-0 bg-black/35" onClick={() => setMobileMenuOpen(false)} />
              <div className="absolute inset-y-0 left-0">{SidebarContent}</div>
            </div>
          ) : null}

          <section className="relative mx-auto w-full max-w-5xl px-6 pb-10 pt-24 md:pt-20">
            <div className="rounded-3xl border border-slate-900/10 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-8">
              <div className="grid items-center gap-6 md:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-slate-500">Dashboard</p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                    Welcome Back, {currentUser?.user_metadata?.first_name ?? currentUser?.email?.split("@")[0] ?? "there"}
                  </h1>
                  <p className="mt-2 text-sm text-[#d8cd72]">Your day at a glance, with the most important actions first.</p>
                </div>

                <div className="h-36 rounded-3xl border border-slate-900/10 bg-slate-200/70 md:h-44" />
              </div>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <section className="rounded-3xl border border-slate-900/10 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">Up Next</h2>
                  <span className="rounded-full bg-[#d8cd72]/25 px-2.5 py-1 text-xs font-semibold text-slate-900">{pendingTaskCount}</span>
                </div>
                <button
                  onClick={() => router.push("/checkins/task/[taskId]")}
                  className="mt-4 w-full rounded-2xl border border-slate-900/10 bg-slate-50 p-4 text-left hover:bg-slate-100"
                >
                  <p className="text-sm font-semibold text-slate-900">Complete your next check-in</p>
                  <p className="mt-1 text-sm text-slate-600">Stay aligned with priorities and keep your progress current.</p>
                </button>
              </section>

              <section className="rounded-3xl border border-slate-900/10 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <h2 className="text-xl font-semibold text-slate-900">Role Advice</h2>
                <div className="mt-4 rounded-2xl border border-slate-900/10 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-semibold text-slate-900">No new updates</p>
                  <p className="mt-1 text-sm text-slate-600">You have no ai insights</p>
                </div>
              </section>
            </div>

            {status ? <p className="mt-6 text-sm text-slate-600">{status}</p> : null}
          </section>
        </>
      )}
    </main>
  );
}
