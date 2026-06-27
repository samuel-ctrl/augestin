import React from "react";

export const DEVELOPER_NAME = "Samuel";
export const PORTFOLIO_URL = "https://samuel-portfolio.pages.dev/";
export const LINKEDIN_URL = "https://www.linkedin.com/in/samuel-ctrl/";

type Variant = "sidebar" | "footer" | "login" | "about";

interface BrandCreditProps {
  variant: Variant;
  className?: string;
  hideCredit?: boolean;
}

const linkAttrs = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

function LinkedInIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function PortfolioIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function BrandCredit({ variant, className = "", hideCredit = false }: BrandCreditProps) {
  if (variant === "sidebar") {
    return (
      <div className={`px-3 py-2 border-t border-white/15 text-xs text-white/70 ${className}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">
            Crafted by{" "}
            <a
              href={PORTFOLIO_URL}
              {...linkAttrs}
              className="font-semibold text-yellow-200 hover:text-yellow-100 underline decoration-dotted underline-offset-2"
            >
              {DEVELOPER_NAME}
            </a>
          </span>
          <a
            href={LINKEDIN_URL}
            {...linkAttrs}
            className="shrink-0 text-white/70 hover:text-cyan-200 transition"
            title="LinkedIn"
            aria-label="LinkedIn"
          >
            <LinkedInIcon className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  if (variant === "footer") {
    return (
      <footer
        className={`shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-4 py-2 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between gap-2 ${className}`}
      >
        <span>&copy; 2026 UltrAIment. All rights reserved.</span>
        {!hideCredit && (
          <span>
            Developed by{" "}
            <a
              href={PORTFOLIO_URL}
              {...linkAttrs}
              className="font-semibold text-blue-700 hover:text-blue-900 underline decoration-dotted underline-offset-2"
              title="Portfolio"
            >
              {DEVELOPER_NAME}
            </a>
          </span>
        )}
      </footer>
    );
  }

  if (variant === "login") {
    return (
      <div className={`mt-6 pt-4 border-t border-gray-200 text-center ${className}`}>
        <p className="text-sm text-gray-600">
          Crafted with care by{" "}
          <a
            href={PORTFOLIO_URL}
            {...linkAttrs}
            className="font-semibold text-blue-700 hover:text-blue-900"
          >
            {DEVELOPER_NAME}
          </a>
        </p>
      </div>
    );
  }

  // about
  return (
    <div className={`rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {DEVELOPER_NAME.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">
            Built &amp; maintained by {DEVELOPER_NAME}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Lead developer and partner of AJ ultrAIment.
          </p>
        </div>
      </div>
    </div>
  );
}
