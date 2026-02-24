"use client";

import { useEffect, useState } from "react";
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

export default function InboxClient({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

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

    // Setup Supabase Realtime
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
        (payload) => {
          setToast("New notification received!");
          setTimeout(() => setToast(null), 3000);
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

      if (res.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const unreadNotifications = notifications.filter((n) => !n.read_at);
  const readNotifications = notifications.filter((n) => n.read_at);

  if (loading) {
    return <div className="text-gray-600">Loading notifications...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Inbox</h1>

      {toast && (
        <div className="mb-4 p-4 bg-blue-100 border border-blue-300 rounded text-blue-800">
          {toast}
        </div>
      )}

      {/* Badge Count */}
      {unreadNotifications.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <span className="font-semibold">
            {unreadNotifications.length} unread notification
            {unreadNotifications.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Unread Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Unread</h2>
        {unreadNotifications.length === 0 ? (
          <p className="text-gray-500">No unread notifications</p>
        ) : (
          <div className="space-y-3">
            {unreadNotifications.map((notification) => (
              <div
                key={notification.id}
                className="p-4 bg-white border border-gray-300 rounded shadow-sm"
              >
                <h3 className="font-semibold text-lg">{notification.title}</h3>
                <p className="text-gray-700 mt-1">{notification.message}</p>
                {notification.link && (
                  <a
                    href={notification.link}
                    className="text-blue-600 hover:underline text-sm mt-2 inline-block"
                  >
                    View Details →
                  </a>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {new Date(notification.created_at).toLocaleString()}
                  </span>
                  <button
                    onClick={() => markAsRead(notification.id)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Mark as read
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Read Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Read</h2>
        {readNotifications.length === 0 ? (
          <p className="text-gray-500">No read notifications</p>
        ) : (
          <div className="space-y-3">
            {readNotifications.map((notification) => (
              <div
                key={notification.id}
                className="p-4 bg-gray-50 border border-gray-200 rounded"
              >
                <h3 className="font-semibold text-gray-700">
                  {notification.title}
                </h3>
                <p className="text-gray-600 mt-1">{notification.message}</p>
                {notification.link && (
                  <a
                    href={notification.link}
                    className="text-blue-600 hover:underline text-sm mt-2 inline-block"
                  >
                    View Details →
                  </a>
                )}
                <div className="mt-3">
                  <span className="text-xs text-gray-400">
                    {new Date(notification.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
