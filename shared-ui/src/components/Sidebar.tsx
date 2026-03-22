import React, { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import type { NavItem } from "../types";

interface SidebarProps {
  navItems: NavItem[];
  logo?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

export function Sidebar({ navItems, logo, collapsed = false, onToggleCollapse, onClose, userName, userRole, onLogout }: SidebarProps) {
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-indigo-900 via-purple-900 to-indigo-950 text-white relative overflow-hidden">
      {/* Background decorative shapes */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-20 left-0 w-24 h-24 bg-indigo-400/10 rounded-full -translate-x-1/2" />
      <div className="absolute top-1/2 right-0 w-16 h-16 bg-pink-400/10 rounded-full translate-x-1/3" />

      {/* Logo / Header */}
      <div className={`py-5 flex items-center border-b border-white/10 relative z-10 ${collapsed ? "px-2 justify-center" : "px-4 justify-between"}`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            {logo || (
              <span className="text-xl tracking-wide bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                <span className="font-extrabold italic">A.J</span>
                <span className="font-light ml-1.5">EduTrack</span>
              </span>
            )}
          </div>
        )}
        {collapsed && (
          <span className="text-xl font-extrabold italic tracking-wide bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">A.J</span>
        )}
        <div className="flex items-center gap-1">
          {onClose && !collapsed && (
            <button
              className="lg:hidden p-1 rounded hover:bg-white/10"
              onClick={onClose}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {onToggleCollapse && !collapsed && (
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-yellow-300 hover:bg-white/15 hover:text-yellow-200 transition-all duration-200"
              title="Collapse sidebar"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav className={`flex-1 py-4 space-y-1 relative z-10 ${collapsed ? "px-2" : "px-3"}`}>
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
              } ${
                isActive
                  ? "bg-white/20 text-white shadow-lg shadow-purple-900/30 backdrop-blur-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
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

      {/* User profile with dropdown */}
      <div className={`border-t border-white/10 relative z-20 ${collapsed ? "px-2 py-3" : "px-3 py-3"}`} ref={dropdownRef}>
        {/* Dropdown menu — opens upward */}
        {dropdownOpen && (
          <div className={`absolute bottom-full mb-2 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 overflow-hidden ${
            collapsed ? "left-full ml-2 bottom-0 mb-0 w-48" : "left-3 right-3"
          }`}>
            {onLogout && (
              <button
                onClick={() => { onLogout(); setDropdownOpen(false); }}
                className="flex items-center gap-3 w-full px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3h-9m9 0l-3-3m3 3l-3 3" />
                </svg>
                <span>Logout</span>
              </button>
            )}
          </div>
        )}

        {/* Clickable user row */}
        {userName && (
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`flex items-center w-full rounded-xl transition-all duration-200 hover:bg-white/10 ${
              collapsed ? "justify-center p-2" : "gap-3 px-2 py-2"
            } ${dropdownOpen ? "bg-white/10" : ""}`}
            title={collapsed ? `${userName} (${userRole})` : undefined}
          >
            {/* Avatar circle */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center shrink-0 text-sm font-bold text-indigo-900 uppercase shadow-md">
              {userName.charAt(0)}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-white truncate">{userName}</div>
                  {userRole && (
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-wider bg-gradient-to-r from-yellow-400/20 to-orange-400/20 text-yellow-300 px-2 py-0.5 rounded-full mt-0.5">
                      {userRole}
                    </span>
                  )}
                </div>
                <svg className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>

      {/* Expand toggle at bottom when collapsed */}
      {onToggleCollapse && collapsed && (
        <div className="px-2 pb-3 relative z-10">
          <button
            onClick={onToggleCollapse}
            className="flex items-center justify-center w-full rounded-xl py-2 text-white/50 hover:bg-white/10 hover:text-white/80 transition-all duration-200"
            title="Expand sidebar"
          >
            <svg className="h-5 w-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
