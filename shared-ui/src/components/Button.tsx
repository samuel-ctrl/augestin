import React, { useState } from "react";

type ButtonVariant = "solid" | "outline" | "ghost";
type ButtonColor = "primary" | "success" | "danger" | "warning" | "secondary";
type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  variant?: ButtonVariant;
  color?: ButtonColor;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
  children: React.ReactNode;
}

const spinnerSizes: Record<ButtonSize, string> = {
  xs: "w-3.5 h-3.5",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-[18px] h-[18px]",
};

const colorStyles: Record<ButtonColor, Record<ButtonVariant, string>> = {
  primary: {
    solid: "bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-200",
    outline: "border border-primary-300 text-primary-500 hover:bg-primary-50 focus:ring-primary-200",
    ghost: "text-primary-500 hover:text-primary-600 hover:bg-primary-50 focus:ring-primary-200",
  },
  success: {
    solid: "bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-200",
    outline: "border border-emerald-300 text-emerald-500 hover:bg-emerald-50 focus:ring-emerald-200",
    ghost: "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 focus:ring-emerald-200",
  },
  danger: {
    solid: "bg-rose-500 text-white hover:bg-rose-600 focus:ring-rose-200",
    outline: "border border-rose-300 text-rose-500 hover:bg-rose-50 focus:ring-rose-200",
    ghost: "text-rose-400 hover:text-rose-500 hover:bg-rose-50 focus:ring-rose-200",
  },
  warning: {
    solid: "bg-amber-400 text-white hover:bg-amber-500 focus:ring-amber-200",
    outline: "border border-amber-300 text-amber-500 hover:bg-amber-50 focus:ring-amber-200",
    ghost: "text-amber-400 hover:text-amber-500 hover:bg-amber-50 focus:ring-amber-200",
  },
  secondary: {
    solid: "bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-200",
    outline: "border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-200",
    ghost: "text-gray-400 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-200",
  },
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "px-2.5 py-1 text-xs",
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-2.5 text-base",
};

export function Button({
  variant = "solid",
  color = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  className = "",
  disabled,
  onClick,
  children,
  ...props
}: ButtonProps) {
  const [autoLoading, setAutoLoading] = useState(false);
  const isLoading = loading || autoLoading;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!onClick || isLoading) return;
    const result = onClick(e);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setAutoLoading(true);
      (result as Promise<unknown>).finally(() => setAutoLoading(false));
    }
  };

  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        isLoading ? "cursor-wait" : "",
        colorStyles[color][variant],
        sizeStyles[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || isLoading}
      onClick={handleClick}
      {...props}
    >
      {isLoading && (
        <svg
          className={`animate-spin ${spinnerSizes[size]}`}
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
