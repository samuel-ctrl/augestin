import React, { useState, useEffect } from "react";
import type { NavItem, BreadcrumbSegment } from "../types";
import type { WSStatus } from "../hooks/useWebSocket";
import { Sidebar } from "./Sidebar";
import { Breadcrumb } from "./Breadcrumb";
import { BrandCredit } from "./BrandCredit";

interface AppLayoutProps {
  children: React.ReactNode;
  navItems: NavItem[];
  breadcrumbs?: BreadcrumbSegment[];
  userName: string;
  userRole: string;
  onLogout: () => void;
  logo?: React.ReactNode;
  notificationCount?: number;
  onNotificationClick?: () => void;
  wsStatus?: WSStatus;
  hideCredit?: boolean;
  showDateTime?: boolean;
  isDark?: boolean;
  onThemeToggle?: () => void;
}

export function AppLayout({
  children,
  navItems,
  breadcrumbs,
  userName,
  userRole,
  onLogout,
  logo,
  notificationCount,
  onNotificationClick,
  wsStatus,
  hideCredit,
  showDateTime,
  isDark,
  onThemeToggle,
}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!showDateTime) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [showDateTime]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarCollapsed ? "w-16" : "w-64"
        } ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Sidebar
          navItems={navItems}
          logo={logo}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onClose={() => setSidebarOpen(false)}
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
          notificationCount={notificationCount}
          onNotificationClick={onNotificationClick}
          wsStatus={wsStatus}
          hideCredit={hideCredit}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative border-l-2 border-gray-400/30 dark:border-gray-700/50">
        {/* Top bar */}
        {showDateTime ? (
          <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setSidebarOpen(true)}
              >
                <svg className="h-6 w-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {breadcrumbs && breadcrumbs.length > 0 && (
                <div className="lg:hidden">
                  <Breadcrumb segments={breadcrumbs} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 tabular-nums select-none">
                <span>
                  {now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span className="text-gray-400 dark:text-gray-500">•</span>
                <span>
                  {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                </span>
              </div>
              {onThemeToggle && (
                <button
                  onClick={onThemeToggle}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                  title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {isDark ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <button
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="h-6 w-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {breadcrumbs && breadcrumbs.length > 0 && (
              <Breadcrumb segments={breadcrumbs} />
            )}
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 bg-blue-50 dark:bg-gray-900">{children}</main>

        {/* Developer footer */}
        <BrandCredit variant="footer" hideCredit={hideCredit} />
      </div>
    </div>
  );
}
