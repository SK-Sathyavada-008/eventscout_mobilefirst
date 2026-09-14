"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationItem, NotificationsResponse } from "@/types/notification";

export default function AlertsPage() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "deadlines" | "new_events">("all");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      if (token && !token.startsWith("demo-token-")) {
        const res = await fetch(`${apiUrl}/notifications?limit=30`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: NotificationsResponse = await res.json();
          setNotifications(data.notifications);
          setLoading(false);
          return;
        }
      }

      // Realistic notification items
      setNotifications([
        {
          id: "alert-1",
          user_id: "user-1",
          event_id: "devfolio-1",
          type: "deadline",
          title: "Registration closing soon",
          message: "BreakPoint 2025 — Closes in 2 days",
          event_url: "/explore?q=BreakPoint",
          read: false,
          created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
          metadata: {
            organizer: "AWS SBG",
            location: "Hyderabad, Offline",
          },
        },
        {
          id: "alert-2",
          user_id: "user-1",
          event_id: "mlh-1",
          type: "recommendation",
          title: "New event for you",
          message: "Google Gen AI Workshop — Matches your interests (AI/ML)",
          event_url: "/explore?q=AI",
          read: false,
          created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
          metadata: {
            organizer: "Google Developers",
            location: "Online",
          },
        },
        {
          id: "alert-3",
          user_id: "user-1",
          event_id: "aws-1",
          type: "reminder",
          title: "Reminder",
          message: "AWS Certification Bootcamp — Starts tomorrow",
          event_url: "/explore?q=AWS",
          read: true,
          created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          metadata: {
            organizer: "AWS Training",
            location: "Online",
          },
        },
      ]);
    } catch (err) {
      console.warn("Could not fetch live alerts:", err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Mark all read
  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      if (token && !token.startsWith("demo-token-")) {
        await fetch(`${apiUrl}/notifications/read-all`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}
  };

  const handleAlertClick = async (notif: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    try {
      if (token && !token.startsWith("demo-token-")) {
        await fetch(`${apiUrl}/notifications/${notif.id}/read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}

    if (notif.event_url) {
      router.push(notif.event_url);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === "deadlines") return n.type === "deadline";
    if (filter === "new_events") return n.type === "recommendation" || n.type === "new_event";
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-2 pb-12">
      {/* Header matching Screen 7 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white transition-colors active-press"
          >
            ←
          </button>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Alerts
          </h1>
        </div>

        {notifications.some((n) => !n.read) && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Filter Chips matching Screen 7 */}
      <div className="flex items-center gap-2 mb-5">
        {[
          { id: "all", label: "All" },
          { id: "deadlines", label: "Deadlines" },
          { id: "new_events", label: "New Events" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`py-1.5 px-4 rounded-full text-xs font-bold transition-all active-press ${
              filter === tab.id
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-[#131b2e] text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-[#131b2e] border border-slate-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Notification Cards */}
      {!loading && (
        <div className="space-y-3">
          {filtered.map((notif) => {
            const timeAgo = Math.round(
              (Date.now() - new Date(notif.created_at).getTime()) / (1000 * 3600)
            );
            const timeStr = timeAgo < 1 ? "Just now" : timeAgo < 24 ? `${timeAgo}h ago` : `${Math.round(timeAgo / 24)}d ago`;

            return (
              <div
                key={notif.id}
                onClick={() => handleAlertClick(notif)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer active-press flex items-start gap-3.5 relative ${
                  notif.read
                    ? "bg-[#131b2e] border-slate-800/80 text-slate-300 hover:border-slate-700"
                    : "bg-[#18233c] border-indigo-500/40 text-white shadow-md shadow-indigo-950/30"
                }`}
              >
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                    notif.type === "deadline"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : notif.type === "recommendation"
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      : "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  }`}
                >
                  {notif.type === "deadline" ? "🔖" : notif.type === "recommendation" ? "✨" : "🔔"}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="text-xs font-bold truncate text-white">
                      {notif.title}
                    </h3>
                    <span className="text-[10px] text-slate-400">{timeStr}</span>
                  </div>

                  <p className="text-xs font-medium text-slate-300 leading-snug line-clamp-2">
                    {notif.message}
                  </p>

                  {/* Highlights */}
                  {notif.type === "deadline" && (
                    <span className="inline-block text-[10px] font-bold text-rose-400 mt-1.5">
                      ⏳ Closes soon
                    </span>
                  )}
                  {notif.type === "recommendation" && (
                    <span className="inline-block text-[10px] font-bold text-indigo-400 mt-1.5">
                      ⭐ Recommended for you
                    </span>
                  )}
                </div>

                {/* Unread indicator */}
                {!notif.read && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500 absolute top-4 right-4" />
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-10 text-center my-6">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-2xl">
                🔔
              </div>
              <h3 className="text-base font-bold text-white mb-1">No alerts right now</h3>
              <p className="text-xs text-slate-400">
                You're all caught up with event deadlines and recommendations.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
