import React from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void | Promise<unknown>;
  };
  variant?: "default" | "error";
}

export function EmptyState({ icon, title, description, action, variant = "default" }: EmptyStateProps) {
  const isError = variant === "error";
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-16 px-4 text-center">
      {icon && (
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-5 ${
            isError
              ? "bg-red-50 text-red-400"
              : "bg-primary-50 text-primary-400"
          }`}
        >
          {icon}
        </div>
      )}
      <h3
        className={`text-lg font-semibold mb-2 ${
          isError ? "text-gray-700" : "text-gray-600"
        }`}
      >
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-400 mb-6 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && (
        <Button
          color={isError ? "secondary" : "primary"}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
