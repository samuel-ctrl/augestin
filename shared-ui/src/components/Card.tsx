import React from "react";

type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: CardPadding;
  icon?: React.ReactNode;
  title?: React.ReactNode;
  headerAction?: React.ReactNode;
  onClick?: () => void;
}

const paddingStyles: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-6",
  lg: "p-6 sm:p-8",
};

export function Card({
  children,
  className = "",
  padding = "md",
  icon,
  title,
  headerAction,
  onClick,
}: CardProps) {
  return (
    <div
      className={[
        "bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700",
        paddingStyles[padding],
        onClick ? "cursor-pointer transition-shadow hover:shadow-md" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      {(title || headerAction) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {icon}
            {title}
          </h2>
          {headerAction}
        </div>
      )}
      {children}
    </div>
  );
}
