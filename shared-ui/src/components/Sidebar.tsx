import React, { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import type { NavItem } from "../types";
import type { WSStatus } from "../hooks/useWebSocket";
import { NotificationBell } from "./NotificationBell";
import logoSvg from "../assets/logo.svg";

interface SidebarProps {
  navItems: NavItem[];
  logo?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
  notificationCount?: number;
  onNotificationClick?: () => void;
  wsStatus?: WSStatus;
}

export function Sidebar({ navItems, logo, collapsed = false, onToggleCollapse, onClose, userName, userRole, onLogout, notificationCount = 0, onNotificationClick, wsStatus = "disconnected" }: SidebarProps) {
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
      {/* Background decorative bubbles */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-20 left-0 w-28 h-28 bg-indigo-400/10 rounded-full -translate-x-1/2" />
      <div className="absolute top-1/2 right-0 w-20 h-20 bg-pink-400/10 rounded-full translate-x-1/3" />
      <div className="absolute top-1/4 left-2 w-14 h-14 bg-cyan-400/8 rounded-full" />
      <div className="absolute top-[12%] right-4 w-10 h-10 bg-yellow-400/10 rounded-full" />
      <div className="absolute bottom-1/3 right-2 w-24 h-24 bg-purple-300/8 rounded-full" />
      <div className="absolute top-[38%] left-0 w-12 h-12 bg-blue-400/10 rounded-full -translate-x-1/3" />
      <div className="absolute bottom-[15%] right-0 w-16 h-16 bg-violet-400/8 rounded-full translate-x-1/4" />
      <div className="absolute top-[68%] left-6 w-8 h-8 bg-pink-300/12 rounded-full" />
      <div className="absolute bottom-32 left-1/2 w-10 h-10 bg-indigo-300/10 rounded-full" />
      <div className="absolute top-[85%] right-6 w-6 h-6 bg-orange-400/10 rounded-full" />
      <div className="absolute top-[5%] left-1/2 w-7 h-7 bg-white/8 rounded-full" />
      <div className="absolute top-[55%] right-8 w-5 h-5 bg-cyan-300/12 rounded-full" />
      <div className="absolute bottom-[40%] left-4 w-9 h-9 bg-purple-400/10 rounded-full" />
      <div className="absolute top-[30%] right-1 w-6 h-6 bg-pink-500/8 rounded-full" />
      <div className="absolute bottom-[8%] left-1/3 w-11 h-11 bg-indigo-500/8 rounded-full" />
      <div className="absolute top-[78%] right-1/3 w-7 h-7 bg-violet-300/10 rounded-full" />
      <div className="absolute top-[48%] left-10 w-4 h-4 bg-yellow-300/12 rounded-full" />
      <div className="absolute bottom-[25%] right-10 w-8 h-8 bg-blue-300/8 rounded-full" />
      <div className="absolute top-[92%] left-8 w-5 h-5 bg-white/6 rounded-full" />

      {/* Logo / Header */}
      <div className={`py-5 flex items-center border-b border-white/20 relative z-10 ${collapsed ? "px-2 justify-center" : "px-4 justify-between"}`}>
        <div className="flex items-center gap-2">
          {logo || (
            <>
              <img src={logoSvg} alt="A.J EduTrack" className={`brightness-0 invert ${collapsed ? "h-8 w-8 object-contain" : "h-10 w-auto"}`} />
              {!collapsed && (
                <span className="text-xl tracking-wide" style={{ fontFamily: "'Poppins', 'Segoe UI', sans-serif" }}>
                  <span className="font-bold text-yellow-300">Edu</span>
                  <span className="font-light text-cyan-300">Track</span>
                </span>
              )}
            </>
          )}
        </div>
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
          const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
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

      {/* Notification bell */}
      {onNotificationClick && (
        <div className={`relative z-10 border-t border-white/10 ${collapsed ? "px-2 pt-2" : "px-3 pt-2"}`}>
          <NotificationBell
            unreadCount={notificationCount}
            onClick={() => { onNotificationClick(); onClose?.(); }}
            collapsed={collapsed}
          />
        </div>
      )}

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
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center shrink-0 text-sm font-bold text-indigo-900 uppercase shadow-md">
                {userName.charAt(0)}
              </div>
              {collapsed && (
                <span
                  className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-indigo-900 ${
                    wsStatus === "connected"
                      ? "bg-green-400"
                      : wsStatus === "connecting"
                      ? "bg-yellow-400 animate-pulse"
                      : "bg-red-400"
                  }`}
                  title={wsStatus === "connected" ? "Connected" : wsStatus === "connecting" ? "Connecting…" : "Disconnected"}
                />
              )}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                    {userName}
                    <span
                      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                        wsStatus === "connected"
                          ? "bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.6)]"
                          : wsStatus === "connecting"
                          ? "bg-yellow-400 animate-pulse shadow-[0_0_4px_rgba(250,204,21,0.6)]"
                          : "bg-red-400 shadow-[0_0_4px_rgba(248,113,113,0.6)]"
                      }`}
                      title={wsStatus === "connected" ? "Connected" : wsStatus === "connecting" ? "Connecting…" : "Disconnected"}
                    />
                  </div>
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
