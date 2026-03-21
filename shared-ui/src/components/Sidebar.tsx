import React from "react";
import { useLocation, Link } from "react-router-dom";
import type { NavItem } from "../types";

interface SidebarProps {
  navItems: NavItem[];
  logo?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}

export function Sidebar({ navItems, logo, collapsed = false, onToggleCollapse, onClose }: SidebarProps) {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Logo / Header */}
      <div className={`py-5 flex items-center border-b border-gray-200 ${collapsed ? "px-2 justify-center" : "px-4 justify-between"}`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            {logo || (
              <span className="text-xl font-bold text-primary-600">EduTrack</span>
            )}
          </div>
        )}
        {collapsed && (
          <span className="text-xl font-bold text-primary-600">E</span>
        )}
        {onClose && !collapsed && (
          <button
            className="lg:hidden p-1 rounded hover:bg-gray-100"
            onClick={onClose}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className={`flex-1 py-4 space-y-1 ${collapsed ? "px-2" : "px-3"}`}>
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
              } ${
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="w-5 h-5 flex items-center justify-center shrink-0 text-base">
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      {onToggleCollapse && (
        <div className={`border-t border-gray-200 py-3 ${collapsed ? "px-2" : "px-3"}`}>
          <button
            onClick={onToggleCollapse}
            className={`flex items-center w-full rounded-lg py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors ${
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            }`}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              className={`h-5 w-5 shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </div>
  );
}
