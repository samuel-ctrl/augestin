import React, { useCallback, useEffect, useRef, useState } from "react";
import type { AxiosInstance } from "axios";
import { LoadingSpinner } from "./LoadingSpinner";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";
import type { PaginatedResponse } from "../types";

interface Notification {
  id: string;
  recipient_id: string;
  // null for system-generated notifications (e.g. streak), which have no
  // human sender. Both the name and its separator are already guarded below,
  // so such a row simply renders no sender label.
  sender_id: string | null;
  sender_name: string | null;
  message: string;
  is_read: boolean;
  notification_type: string | null;
  reference_id: string | null;
  created_at: string;
}

type TimeFilter = "all" | "today" | "week" | "month" | "custom";

const TIME_FILTER_LABELS: Record<TimeFilter, string> = {
  all: "All",
  today: "Today",
  week: "This Week",
  month: "This Month",
  custom: "Custom",
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDateParams(
  filter: TimeFilter,
  customFrom: string,
  customTo: string,
): { date_from?: string; date_to?: string } {
  const today = new Date();
  switch (filter) {
    case "all":
      return {};
    case "today":
      return { date_from: formatDate(today), date_to: formatDate(today) };
    case "week": {
      const dayOfWeek = today.getDay();
      const mondayOffset = (dayOfWeek + 6) % 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() - mondayOffset);
      return { date_from: formatDate(monday), date_to: formatDate(today) };
    }
    case "month": {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { date_from: formatDate(firstDay), date_to: formatDate(today) };
    }
    case "custom": {
      const result: { date_from?: string; date_to?: string } = {};
      if (customFrom) result.date_from = customFrom;
      if (customTo) result.date_to = customTo;
      return result;
    }
  }
}

interface NotificationsPageProps {
  api: AxiosInstance;
  navigate: (path: string) => void;
  onCountChange?: (count: number) => void;
  on?: (eventType: string, handler: (event: any) => void) => () => void;
}

const PAGE_SIZE = 20;

export function NotificationsPage({ api, navigate, onCountChange, on }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("today");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");

  // WebSocket banner
  const [hasNewNotification, setHasNewNotification] = useState(false);

  const isFirstFetch = useRef(true);

  const fetchNotifications = useCallback(async () => {
    // For custom filter, skip if no dates are set yet
    if (timeFilter === "custom" && !customDateFrom && !customDateTo) return;

    setFetching(true);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      const dateParams = getDateParams(timeFilter, customDateFrom, customDateTo);
      if (dateParams.date_from) params.date_from = dateParams.date_from;
      if (dateParams.date_to) params.date_to = dateParams.date_to;

      const { data } = await api.get<PaginatedResponse<Notification>>("/notifications", { params });
      setNotifications(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.total_pages ?? 0);
    } catch {
      // silently fail
    } finally {
      setFetching(false);
      if (isFirstFetch.current) {
        setInitialLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, [api, page, timeFilter, customDateFrom, customDateTo]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // WebSocket: prepend on page 1 + "all", otherwise show banner
  useEffect(() => {
    if (!on) return;
    return on("notification:created", (event: any) => {
      const n = event.payload as Notification;
      if (page === 1 && timeFilter === "all") {
        setNotifications((prev) => [n, ...prev].slice(0, PAGE_SIZE));
        setTotal((prev) => prev + 1);
        setTotalPages((prev) => Math.max(prev, Math.ceil((total + 1) / PAGE_SIZE)));
      } else {
        setHasNewNotification(true);
      }
    });
  }, [on, page, timeFilter, total]);

  const handleFilterChange = (filter: TimeFilter) => {
    setTimeFilter(filter);
    setPage(1);
    setHasNewNotification(false);
  };

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

  const [processingDelete, setProcessingDelete] = useState<string | null>(null);

  const handleProceedDelete = async (n: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!n.reference_id) return;
    setProcessingDelete(n.id);
    try {
      await api.delete(`/doubts/${n.reference_id}`);
      if (!n.is_read) markRead(n.id);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === n.id ? { ...notif, is_read: true, message: notif.message + " (Deleted)" } : notif
        )
      );
    } catch {
      // silently fail
    } finally {
      setProcessingDelete(null);
    }
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    if (n.reference_id && (n.notification_type === "doubt_created" || n.notification_type === "doubt_comment" || n.notification_type === "doubt_status" || n.notification_type === "doubt_delete_request" || n.notification_type === "doubt_edited" || n.notification_type === "doubt_comment_edited" || n.notification_type === "doubt_comment_deleted")) {
      navigate(`/doubts/${n.reference_id}`);
    } else if (n.notification_type === "book_assigned" || n.notification_type === "book_unassigned") {
      navigate("/self-study");
    } else if (n.notification_type === "quiz_set_assigned" || n.notification_type === "quiz_set_unassigned") {
      navigate("/quiz-sets");
    } else if (n.notification_type === "test_set_assigned" || n.notification_type === "test_set_unassigned") {
      navigate("/test-sets");
    } else if (n.notification_type?.startsWith("streak_")) {
      // Covers streak_at_risk, streak_milestone, and the retired
      // streak_earned rows still in the table. Matches the startsWith test
      // used for the cursor-pointer class below, so a clickable row always
      // actually goes somewhere.
      navigate("/profile");
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (initialLoading) return <LoadingSpinner />;

  const showingFrom = total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(page * PAGE_SIZE, total);

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
        {/* Time range filter */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(Object.keys(TIME_FILTER_LABELS) as TimeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                timeFilter === f
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {TIME_FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {timeFilter === "custom" && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-sm text-gray-600 dark:text-gray-300">
              From:
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => { setCustomDateFrom(e.target.value); setPage(1); }}
                className="ml-2 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="text-sm text-gray-600 dark:text-gray-300">
              To:
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => { setCustomDateTo(e.target.value); setPage(1); }}
                className="ml-2 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </label>
          </div>
        )}

        {/* New notification banner */}
        {hasNewNotification && (
          <button
            onClick={() => { setPage(1); setTimeFilter("all"); setHasNewNotification(false); }}
            className="w-full text-center py-2 mb-3 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            New notifications available - click to refresh
          </button>
        )}

        {fetching && !initialLoading && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!fetching && notifications.length === 0 ? (
          <EmptyState
            title="No notifications"
            description={
              timeFilter !== "all"
                ? "No notifications found for this time period."
                : "You're all caught up! Notifications will appear here for assignments, doubts, and more."
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left rounded-lg border p-4 transition-colors ${
                    n.is_read
                      ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                      : "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  } ${n.reference_id || n.notification_type?.includes("assigned") || n.notification_type?.startsWith("streak_") ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 ${n.is_read ? "text-gray-400" : "text-blue-500"}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                      </svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${n.is_read ? "text-gray-600 dark:text-gray-400" : "text-gray-900 dark:text-gray-100 font-medium"}`}>
                        {n.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {n.sender_name && (
                          <span className="text-xs font-medium text-primary-600">
                            {n.sender_name}
                          </span>
                        )}
                        {n.sender_name && <span className="text-xs text-gray-300 dark:text-gray-600">·</span>}
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(n.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {n.notification_type && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {n.notification_type === "doubt_created"
                              ? "New Doubt"
                              : n.notification_type === "doubt_edited"
                              ? "Doubt Edited"
                              : n.notification_type === "doubt_comment"
                              ? "Comment"
                              : n.notification_type === "doubt_comment_edited"
                              ? "Comment Edited"
                              : n.notification_type === "doubt_comment_deleted"
                              ? "Comment Deleted"
                              : n.notification_type === "doubt_status"
                              ? "Status Change"
                              : n.notification_type === "doubt_delete_request"
                              ? "Delete Request"
                              : n.notification_type === "manual"
                              ? "Reminder"
                              : n.notification_type === "streak_at_risk"
                              ? "Streak at Risk"
                              : n.notification_type === "streak_milestone"
                              ? "Milestone"
                              // Retired with the weekly streak model. Kept so
                              // rows already in the table still get a label
                              // instead of falling through to "Message".
                              : n.notification_type === "streak_earned"
                              ? "Streak"
                              : n.notification_type?.endsWith("_assigned")
                              ? "Assigned"
                              : n.notification_type?.endsWith("_unassigned")
                              ? "Unassigned"
                              : "Message"}
                          </span>
                        )}
                      </div>
                    </div>
                    {n.notification_type === "doubt_delete_request" && !n.message.endsWith("(Deleted)") && (
                      <button
                        onClick={(e) => handleProceedDelete(n, e)}
                        disabled={processingDelete === n.id}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {processingDelete === n.id ? "Deleting..." : "Proceed"}
                      </button>
                    )}
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {showingFrom}-{showingTo} of {total}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
