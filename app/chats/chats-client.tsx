"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { MENU_BUBBLE_BUTTON } from "@/lib/menu-styles";
import AppMenu from "@/app/components/AppMenu";
import TopNav from "@/app/components/TopNav";

type Session = {
  id: string;
  title: string;
  updated_at: string;
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export default function ChatsClient() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  
  useEffect(() => {
    fetchSessions();
    void fetchPendingCount();
  }, []);

  async function fetchSessions() {
    try {
      setLoading(true);
      const res = await fetch("/api/chat/sessions");
      if (!res.ok) {
        throw new Error("Failed to fetch sessions");
      }
      const data = await res.json();
      setSessions(data.sessions || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch sessions");
    } finally {
      setLoading(false);
    }
  }
  async function fetchPendingCount() {
    try {
      const { count } = await supabase
        .from("checkin_tasks")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      setPendingCount(count ?? 0);
    } catch (err) {
      console.error("Failed to fetch pending count:", err);
      setPendingCount(0);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  const SidebarContent = (
    <aside className="fixed inset-0 z-50 flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-900/10 px-8 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Menu</p>
        <button
          onClick={() => setMenuOpen(false)}
          className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-lg font-semibold text-[#d8cd72] hover:bg-slate-50"
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      <nav className="flex-1 overflow-hidden px-6 py-4">
        <div className="flex h-full flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              router.push("/workspace?newChat=1");
            }}
            className={MENU_BUBBLE_BUTTON}
          >
            New chat
          </button>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              router.push("/chats");
            }}
            className={MENU_BUBBLE_BUTTON}
          >
            Your chats
          </button>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              router.push("/tasks");
            }}
            className={MENU_BUBBLE_BUTTON}
          >
            Your tasks
          </button>
        </div>
      </nav>

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
          <TopNav badgeCount={pendingCount} onMenuClick={() => setMenuOpen(true)} />
          {menuOpen ? SidebarContent : null}

          <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-7 pb-8 pt-4 md:px-10 md:pt-6">
            <section className="flex-1">
              <div className="mb-6">
                <h1 className="text-left text-2xl font-semibold">Your chats</h1>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-slate-500">Loading chats...</p>
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              ) : sessions.length === 0 ? (
                <div className="rounded-2xl border border-slate-900/10 bg-white p-8 text-center">
                  <p className="text-sm text-slate-500">No chats yet. Start a conversation!</p>
                  <button
                    onClick={() => router.push("/workspace?newChat=1")}
                    className="mt-4 rounded-2xl border border-slate-900/10 bg-[#f0f1c9] px-6 py-2 text-sm font-semibold text-slate-900 hover:bg-[#e3e5b4]"
                  >
                    New chat
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => router.push(`/workspace?sessionId=${session.id}`)}
                      className="w-full rounded-2xl border border-slate-900/10 bg-white px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 truncate">
                            {session.title || "Untitled chat"}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(session.updated_at)}
                          </p>
                        </div>
                        <span className="text-slate-400 text-sm">›</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
