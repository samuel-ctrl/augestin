import React, { useState, useEffect, useRef } from "react";

interface NotificationBellProps {
  unreadCount: number;
  onClick: () => void;
  collapsed?: boolean;
}

export function NotificationBell({ unreadCount, onClick, collapsed = false }: NotificationBellProps) {
  const [flash, setFlash] = useState(false);
  const prevCountRef = useRef(unreadCount);

  // Flash animation when unread count increases (new notification arrived)
  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 2000);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  return (
    <button
      onClick={onClick}
      title={collapsed ? `Notifications${unreadCount > 0 ? ` (${unreadCount})` : ""}` : undefined}
      className={`w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200 hover:bg-white/10 hover:text-white ${
        unreadCount > 0 ? "text-white" : "text-white/70"
      } ${collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"}`}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0 relative">
        <svg className={`w-5 h-5 ${flash ? "animate-[bell-ring_0.5s_ease-in-out_2]" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <>
            {/* Ping animation on new notification */}
            {flash && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-400 animate-ping" />
            )}
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          </>
        )}
      </span>
      {!collapsed && (
        <span className="flex items-center gap-2">
          Notifications
          {unreadCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          )}
        </span>
      )}
    </button>
  );
}
