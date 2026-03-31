import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backButton?: {
    label: string;
    onClick: () => void;
  };
}

export function PageHeader({
  title,
  subtitle,
  actions,
  backButton,
}: PageHeaderProps) {
  return (
    <div
      className="mb-6 -mx-6 -mt-6 px-6 pt-5 pb-5 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #312e81 0%, rgba(88, 28, 135, 0.7) 50%, #312e81 100%)" }}
    >
      {/* Decorative bubbles — centered */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-28 h-28 bg-purple-400/15 rounded-full" />
      <div className="absolute -bottom-4 left-[45%] -translate-x-1/2 w-20 h-20 bg-indigo-400/12 rounded-full" />
      <div className="absolute top-2 left-[55%] -translate-x-1/2 w-10 h-10 bg-pink-400/10 rounded-full" />

      {/* Content */}
      <div className="relative z-10">
        {backButton && (
          <button
            onClick={backButton.onClick}
            className="text-sm text-gray-300 hover:text-white mb-2 inline-flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {backButton.label}
          </button>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-300 mt-1">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
