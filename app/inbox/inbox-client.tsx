"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link?: string;
  read_at?: string;
  created_at: string;
}

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export default function InboxClient({ userId }: { userId: string }) {
  const router = useRouter();
  const supabaseAuth = useMemo(() => getSupabaseBrowserClient(), []);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // “toast” but premium = subtle banner
  const [banner, setBanner] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpenDesktop, setSidebarOpenDesktop] = useState(true);

  useEffect(() => setMounted(true), []);

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
          setBanner("New notification received.");
          setTimeout(() => setBanner(null), 2500);
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

  async function handleSignOut() {
    await supabaseAuth.auth.signOut();
    router.push("/");
  }

  const unreadNotifications = notifications.filter((n) => !n.read_at);
  const readNotifications = notifications.filter((n) => n.read_at);

  const Sidebar = (
    <aside className={cx("flex h-full flex-col border-r border-slate-900/10 bg-white", sidebarOpenDesktop ? "w-80" : "w-20")}>
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="h-10 w-10 rounded-2xl bg-[#c7c85a]/30" />
        {sidebarOpenDesktop ? (
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">NetworkSpace</p>
            <p className="text-xs text-slate-500">AI Check-Ins</p>
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

      <nav className="px-3">
        {sidebarOpenDesktop ? (
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Menu</p>
        ) : null}

        <div className="space-y-1">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/workspace");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="h-2 w-2 rounded-full bg-slate-200" />
            {sidebarOpenDesktop ? <span>Workspace</span> : null}
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/tasks");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="h-2 w-2 rounded-full bg-slate-200" />
            {sidebarOpenDesktop ? <span>Tasks</span> : null}
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              router.push("/inbox");
            }}
            className="flex w-full items-center gap-3 rounded-xl bg-[#c7c85a]/20 px-3 py-2.5 text-sm font-medium text-slate-900"
          >
            <span className="h-2 w-2 rounded-full bg-[#c7c85a]" />
            {sidebarOpenDesktop ? <span>Inbox</span> : null}
            {sidebarOpenDesktop && unreadNotifications.length > 0 ? (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c7c85a] px-1.5 text-[11px] font-semibold text-[#0f172a]">
                {unreadNotifications.length > 99 ? "99+" : unreadNotifications.length}
              </span>
            ) : null}
          </button>
        </div>
      </nav>

      <div className="mt-auto border-t border-slate-900/10 px-5 py-4">
        <button
          onClick={handleSignOut}
          className="w-full rounded-2xl border border-slate-900/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </aside>
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <div className="p-8 text-slate-600">Loading notifications…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-900" suppressHydrationWarning>
      {!mounted ? null : (
        <>
          <div className="pointer-events-none fixed inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(199,200,90,0.18),transparent_45%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(15,23,42,0.06),transparent_55%)]" />
          </div>

          <div className="relative flex min-h-screen">
            <div className="hidden md:block">{Sidebar}</div>

            <div className="md:hidden fixed left-0 right-0 top-0 z-20 border-b border-slate-900/10 bg-white/90 backdrop-blur">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Menu
                </button>
                <div className="text-sm font-semibold text-slate-900">Inbox</div>
                <button
                  onClick={() => router.push("/workspace")}
                  className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Workspace
                </button>
              </div>
            </div>

            {mobileMenuOpen ? (
              <div className="md:hidden fixed inset-0 z-30">
                <div className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
                <div className="absolute inset-y-0 left-0">
                  <div className="h-full w-80">{Sidebar}</div>
                </div>
              </div>
            ) : null}

            <section className="flex-1 px-5 pb-8 pt-20 md:px-10 md:pt-8">
              <div className="mx-auto w-full max-w-3xl">
                <div className="mb-6 hidden md:block">
                  <h1 className="text-2xl font-semibold">Inbox</h1>
                  <p className="mt-1 text-sm text-slate-500">Notifications that route you to what matters.</p>
                </div>

                {banner ? (
                  <div className="mb-4 rounded-2xl border border-[#c7c85a]/40 bg-[#c7c85a]/15 px-4 py-3 text-sm font-semibold text-slate-900">
                    {banner}
                  </div>
                ) : null}

                {unreadNotifications.length > 0 ? (
                  <div className="mb-4 rounded-2xl border border-slate-900/10 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <span className="font-semibold">{unreadNotifications.length}</span> unread notification
                    {unreadNotifications.length !== 1 ? "s" : ""}.
                  </div>
                ) : null}

                {/* Unread */}
                <div className="mb-8">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Unread</h2>

                  <div className="mt-3 space-y-3">
                    {unreadNotifications.length === 0 ? (
                      <div className="rounded-3xl border border-slate-900/10 bg-white p-6 text-sm text-slate-600">
                        No unread notifications.
                      </div>
                    ) : (
                      unreadNotifications.map((n) => (
                        <div key={n.id} className="rounded-3xl border border-slate-900/10 bg-white p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold text-slate-900">{n.title}</p>
                              <p className="mt-1 text-sm text-slate-700">{n.message}</p>
                              <p className="mt-3 text-xs text-slate-500">{new Date(n.created_at).toLocaleString()}</p>
                            </div>

                            <button
                              onClick={() => markAsRead(n.id)}
                              className="shrink-0 rounded-2xl border border-slate-900/10 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              Mark read
                            </button>
                          </div>

                          {n.link ? (
                            <button
                              onClick={() => router.push(n.link!)}
                              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#2f343a] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                            >
                              Open
                              <span aria-hidden="true">↗</span>
                            </button>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Read */}
                <div>
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Read</h2>

                  <div className="mt-3 space-y-3">
                    {readNotifications.length === 0 ? (
                      <div className="rounded-3xl border border-slate-900/10 bg-slate-50 p-6 text-sm text-slate-600">
                        No read notifications.
                      </div>
                    ) : (
                      readNotifications.map((n) => (
                        <div key={n.id} className="rounded-3xl border border-slate-900/10 bg-slate-50 p-5">
                          <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                          <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                          <p className="mt-3 text-xs text-slate-500">{new Date(n.created_at).toLocaleString()}</p>
                          {n.link ? (
                            <button
                              onClick={() => router.push(n.link!)}
                              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-800 hover:underline"
                            >
                              Open <span aria-hidden="true">→</span>
                            </button>
                          ) : null}
                        </div>
                      ))
                    )}
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
