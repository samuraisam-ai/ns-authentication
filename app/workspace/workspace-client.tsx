"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "assistant" | "user"; content: string };

export default function WorkspaceClient() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hey — I’m your NetworkSpace assistant. What do you want to handle right now? (Tasks, check-ins, weekly reflection, onboarding)",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");

    // Placeholder assistant response
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Got it. If you want, say: “Show my tasks” or “Open my next check-in.”",
        },
      ]);
      setIsSending(false);
    }, 500);
  }

  return (
    <div className="flex min-h-[70vh] flex-col">
      {/* Chat area */}
      <div className="flex-1 space-y-3 overflow-auto rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-bg)] p-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={[
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              msg.role === "user"
                ? "ml-auto bg-[var(--ns-charcoal)] text-white"
                : "bg-white border border-[var(--ns-border)] text-[var(--ns-text)]",
            ].join(" ")}
          >
            {msg.content}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-2xl border border-[var(--ns-border)] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ns-olive)]/50"
          placeholder="Type your message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button
          onClick={send}
          disabled={isSending || !input.trim()}
          className="rounded-2xl bg-[var(--ns-charcoal)] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSending ? "Sending…" : "Send"}
        </button>
      </div>

      <div className="mt-3 text-xs text-black/55">
        Tip: Keep it short. The system is designed for busy people.
      </div>
    </div>
  );
}
