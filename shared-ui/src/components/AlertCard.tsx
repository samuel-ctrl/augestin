import React from "react";

export type AlertCardVariant = "info" | "warning" | "danger" | "success";

interface AlertCardProps {
  variant: AlertCardVariant;
  message: string;
  className?: string;
}

const config: Record<AlertCardVariant, { bg: string; border: string; text: string; iconColor: string; icon: string }> = {
  info: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-300",
    iconColor: "text-blue-500 dark:text-blue-400",
    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-300",
    iconColor: "text-amber-500 dark:text-amber-400",
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  },
  danger: {
    bg: "bg-red-50 dark:bg-red-900/30",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-800 dark:text-red-300",
    iconColor: "text-red-500 dark:text-red-400",
    icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  success: {
    bg: "bg-green-50 dark:bg-green-900/30",
    border: "border-green-200 dark:border-green-800",
    text: "text-green-800 dark:text-green-300",
    iconColor: "text-green-500 dark:text-green-400",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

export function AlertCard({ variant, message, className = "" }: AlertCardProps) {
  const c = config[variant];

  return (
    <div className={`${c.bg} border ${c.border} rounded-lg p-4 flex items-start gap-3 ${className}`}>
      <svg className={`h-5 w-5 ${c.iconColor} shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
      </svg>
      <p className={`text-sm ${c.text}`}>{message}</p>
    </div>
  );
}
