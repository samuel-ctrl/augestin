import React from "react";
import { Link } from "react-router-dom";

type Variant = "session-expired" | "logged-out";

interface AuthStatusPageProps {
  variant: Variant;
  loginPath?: string;
}

const CONFIG: Record<Variant, { icon: React.ReactNode; title: string; message: string; cta: string; accent: string }> = {
  "session-expired": {
    icon: (
      <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Your session has expired",
    message:
      "For your security, you've been signed out due to inactivity or an expired session. Please sign in again to continue.",
    cta: "Sign in again",
    accent: "from-amber-500 to-orange-500",
  },
  "logged-out": {
    icon: (
      <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    ),
    title: "You've been signed out",
    message: "Thanks for visiting ultrAIment. You've safely signed out of your account.",
    cta: "Sign in again",
    accent: "from-blue-600 to-cyan-500",
  },
};

export function AuthStatusPage({ variant, loginPath = "/login" }: AuthStatusPageProps) {
  const { icon, title, message, cta, accent } = CONFIG[variant];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 text-center">
        <div
          className={`mx-auto h-16 w-16 rounded-full bg-gradient-to-br ${accent} flex items-center justify-center text-white shadow-lg`}
        >
          {icon}
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-gray-900 dark:text-gray-50">{title}</h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
        <Link
          to={loginPath}
          className="mt-6 inline-flex items-center justify-center w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
