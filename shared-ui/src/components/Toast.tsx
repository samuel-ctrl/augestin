import React, { useEffect, useState } from "react";

export type ToastType = "error" | "success" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  onDismiss: () => void;
  duration?: number;
}

const config: Record<ToastType, { bg: string; border: string; text: string; icon: string; btnColor: string }> = {
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    btnColor: "text-red-400 hover:text-red-600",
  },
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    btnColor: "text-green-400 hover:text-green-600",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    btnColor: "text-blue-400 hover:text-blue-600",
  },
};

const iconColors: Record<ToastType, string> = {
  error: "text-red-500",
  success: "text-green-500",
  info: "text-blue-500",
};

export function Toast({ message, type = "error", onDismiss, duration = 5000 }: ToastProps) {
  const [visible, setVisible] = useState(true);
  const c = config[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      <div className={`${c.bg} border ${c.border} rounded-lg p-4 shadow-lg flex items-start gap-3`}>
        <svg className={`h-5 w-5 ${iconColors[type]} shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
        </svg>
        <div className="flex-1">
          <p className={`text-sm ${c.text}`}>{message}</p>
        </div>
        <button onClick={onDismiss} className={c.btnColor}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
