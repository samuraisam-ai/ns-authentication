"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link?: string;
  read_at?: string;
  created_at: string;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

function Toast({
  open,
  text,
  onClose,
}: {
  open: boolean;
  text: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-x-0 top-3 z-50 mx-auto w-full max-w-lg px-3">
      <div className="rounded-2xl bg-slate-900 text-white shadow-[0_18px_60px_rgba(2,6,23,0.35)] ring-1 ring-white/10">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-[#B8BE3B]" />
            <div className="text-sm font-semibold">{text}</div>
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

export default function InboxClient({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastText, setToastText] = useState("");

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          setToastText("New inbox item received");
          setToastOpen(true);
          window.setTimeout(() => setToastOpen(false), 2600);
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      if (res.ok) fetchNotifications();
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read_at),
    [notifications]
  );
  const readNotifications = useMemo(
    () => notifications.filter((n) => n.read_at),
    [notifications]
  );

  if (loading) {
    return <div className="text-slate-600">Loading inbox…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Toast open={toastOpen} text={toastText} onClose={() => setToastOpen(false)} />

      <div className="mb-6 flex items-center justify-between border-b border-slate-900/10 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inbox</h1>
          <p className="mt-1 text-sm text-slate-600">
            This is a tab. It shows what needs attention and links you to the task.
          </p>
        </div>

        {unreadNotifications.length > 0 ? (
          <span className="inline-flex items-center rounded-full bg-[#B8BE3B] px-3 py-1 text-xs font-bold text-slate-900">
            {unreadNotifications.length} unread
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            All read
          </span>
        )}
      </div>

      {/* Unread */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-slate-600">UNREAD</h2>
        </div>

        {unreadNotifications.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-600 ring-1 ring-slate-200">
            No unread items.
          </div>
        ) : (
          <div className="space-y-3">
            {unreadNotifications.map((n) => (
              <div key={n.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#B8BE3B]" />
                      <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">
                        {n.title}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{n.message}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-200">
                        {formatDateTime(n.created_at)}
                      </span>
                      {n.link ? (
                        <a
                          href={n.link}
                          className="inline-flex items-center rounded-full bg-white px-3 py-1 font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                          Open →
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <button
                    onClick={() => markAsRead(n.id)}
                    className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Mark read
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Read */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-slate-600">READ</h2>
        </div>

        {readNotifications.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-600 ring-1 ring-slate-200">
            No read items yet.
          </div>
        ) : (
          <div className="space-y-3">
            {readNotifications.map((n) => (
              <div key={n.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <h3 className="text-sm font-semibold text-slate-800">{n.title}</h3>
                <p className="mt-2 text-sm text-slate-700">{n.message}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                    {formatDateTime(n.created_at)}
                  </span>
                  {n.link ? (
                    <a
                      href={n.link}
                      className="inline-flex items-center rounded-full bg-white px-3 py-1 font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      Open →
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
