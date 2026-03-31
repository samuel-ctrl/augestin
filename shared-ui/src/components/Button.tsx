import React from "react";

type ButtonVariant = "solid" | "outline" | "ghost";
type ButtonColor = "primary" | "success" | "danger" | "warning" | "secondary";
type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  color?: ButtonColor;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: React.ReactNode;
}

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
    outline: "border border-gray-300 text-gray-600 hover:bg-gray-50 focus:ring-gray-200",
    ghost: "text-gray-400 hover:text-gray-500 hover:bg-gray-50 focus:ring-gray-200",
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
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        colorStyles[color][variant],
        sizeStyles[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
