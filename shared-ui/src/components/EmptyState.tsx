import React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "default" | "error";
}

export function EmptyState({ icon, title, description, action, variant = "default" }: EmptyStateProps) {
  const isError = variant === "error";
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
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
        <button
          onClick={action.onClick}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            isError
              ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
              : "bg-primary-600 text-white hover:bg-primary-700"
          }`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
