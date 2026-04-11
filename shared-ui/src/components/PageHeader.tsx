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
      className="mb-6 -mx-3 -mt-3 px-3 pt-4 pb-4 sm:-mx-4 sm:-mt-4 sm:px-4 md:-mx-6 md:-mt-6 md:px-6 md:pt-5 md:pb-5 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d47a1 0%, rgba(21, 101, 192, 0.8) 50%, #0d47a1 100%)" }}
    >
      {/* Decorative bubbles — centered */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-28 h-28 bg-blue-300/15 rounded-full" />
      <div className="absolute -bottom-4 left-[45%] -translate-x-1/2 w-20 h-20 bg-blue-400/12 rounded-full" />
      <div className="absolute top-2 left-[55%] -translate-x-1/2 w-10 h-10 bg-cyan-300/10 rounded-full" />

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-300 mt-1">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
