import React from "react";
import { useLocation, Link } from "react-router-dom";
import type { NavItem } from "../types";

interface SidebarProps {
  navItems: NavItem[];
  logo?: React.ReactNode;
  onClose?: () => void;
}

export function Sidebar({ navItems, logo, onClose }: SidebarProps) {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Logo / Header */}
      <div className="px-4 py-5 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-2">
          {logo || (
            <span className="text-xl font-bold text-primary-600">EduTrack</span>
          )}
        </div>
        {onClose && (
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
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="w-5 h-5 flex items-center justify-center shrink-0">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
