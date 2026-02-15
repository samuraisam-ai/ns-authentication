"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import Link from "next/link";

type Props = { user: User | null };

type ChatEvent = {
  type: "send" | "receive" | "error";
  messageId: string;
  content: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function logChatEvent(event: ChatEvent) {
  const timestamp = new Date().toISOString();
  const preview = event.content.slice(0, 120);
  const requestId = crypto.randomUUID();
  const chatEvent = {
    message: preview ?? "",
    meta: {
      type: event.type,
      messageId: event.messageId,
      timestamp,
      requestId,
      route: "/workspace",
    },
  };
  console.groupCollapsed(`[chat] ${event.type} ${event.messageId}`);
  console.log("timestamp:", timestamp);
  console.log("type:", event.type);
  console.log("messageId:", event.messageId);
  console.log("preview:", preview);
  console.log("[chat] requestId", requestId);
  console.groupEnd();

  void fetch("/api/chat-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chatEvent),
  }).catch((error) => {
    console.warn("Failed to log chat event", error);
  });
}

export default function WorkspaceClient({ user: initialUser }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", content: "Hello! How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

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
      const res = await fetch("/api/chat-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          user: {
            id: currentUser?.id,
            email: currentUser?.email,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Webhook failed (${res.status}): ${errText}`);
      }

      const data = await res.json();

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: String(data.reply ?? "No reply returned"),
      };

      setMessages((prev) => [...prev, botMessage]);
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
              <div className="w-64 rounded-2xl border border-slate-900/10 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  User Info
                </p>
                {currentUser ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="truncate font-medium text-slate-900">{currentUser.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">User ID</p>
                      <p className="max-w-[14rem] truncate font-mono text-xs text-slate-700">
                        {currentUser.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Last sign in</p>
                      <p className="text-slate-800">
                        {currentUser?.last_sign_in_at
                          ? new Date(currentUser.last_sign_in_at).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">Not authenticated</p>
                )}
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
