import React, { useState } from "react";
import type { NavItem, BreadcrumbSegment } from "../types";
import type { WSStatus } from "../hooks/useWebSocket";
import { Sidebar } from "./Sidebar";
import { Breadcrumb } from "./Breadcrumb";

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
}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
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
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative border-l-2 border-gray-400/30">
        {/* Mobile menu button (only visible on mobile) */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 shrink-0">
          <button
            className="p-1 rounded hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Breadcrumb segments={breadcrumbs} />
          )}
        </div>



        {/* Content */}
        <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6" style={{ backgroundColor: "aliceblue" }}>{children}</main>
      </div>
    </div>
  );
}
