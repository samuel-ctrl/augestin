import React, { useEffect, useState } from "react";
import type { AxiosInstance } from "axios";
import { LoadingSpinner } from "./LoadingSpinner";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";

interface Notification {
  id: string;
  recipient_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  notification_type: string | null;
  reference_id: string | null;
  created_at: string;
}

interface NotificationsPageProps {
  api: AxiosInstance;
  navigate: (path: string) => void;
  onCountChange?: (count: number) => void;
  on?: (eventType: string, handler: (event: any) => void) => () => void;
}

export function NotificationsPage({ api, navigate, onCountChange, on }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get<Notification[]>("/notifications");
      setNotifications(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (!on) return;
    return on("notification:created", (event: any) => {
      const n = event.payload as Notification;
      setNotifications((prev) => [n, ...prev]);
    });
  }, [on]);

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      onCountChange?.(0);
    } catch {
      // silently fail
    }
  };

  const markRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      const unread = notifications.filter((n) => !n.is_read && n.id !== id).length;
      onCountChange?.(unread);
    } catch {
      // silently fail
    }
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    if (n.reference_id && (n.notification_type === "doubt_comment" || n.notification_type === "doubt_status")) {
      navigate(`/doubts/${n.reference_id}`);
    } else if (n.notification_type === "book_assigned" || n.notification_type === "book_unassigned") {
      navigate("/self-study");
    } else if (n.notification_type === "quiz_set_assigned" || n.notification_type === "quiz_set_unassigned") {
      navigate("/quiz-sets");
    } else if (n.notification_type === "test_set_assigned" || n.notification_type === "test_set_unassigned") {
      navigate("/test-sets");
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Notifications"
        actions={
          unreadCount > 0 ? (
            <button
              onClick={markAllRead}
              className="text-sm text-white/80 hover:text-white font-medium bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
            >
              Mark all as read
            </button>
          ) : undefined
        }
      />
      <div className="max-w-3xl mx-auto">

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="You're all caught up! Notifications will appear here for assignments, doubts, and more."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left rounded-lg border p-4 transition-colors ${
                n.is_read
                  ? "bg-white border-gray-200 hover:bg-gray-50"
                  : "bg-blue-50 border-blue-200 hover:bg-blue-100"
              } ${n.reference_id || n.notification_type?.includes("assigned") ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 ${n.is_read ? "text-gray-400" : "text-blue-500"}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.is_read ? "text-gray-600" : "text-gray-900 font-medium"}`}>
                    {n.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-400">
                      {new Date(n.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {n.notification_type && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {n.notification_type === "doubt_comment"
                          ? "Comment"
                          : n.notification_type === "doubt_status"
                          ? "Status"
                          : n.notification_type?.endsWith("_assigned")
                          ? "Assigned"
                          : n.notification_type?.endsWith("_unassigned")
                          ? "Unassigned"
                          : "Message"}
                      </span>
                    )}
                  </div>
                </div>
                {!n.is_read && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
