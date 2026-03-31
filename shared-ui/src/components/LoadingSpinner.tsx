import React from "react";

interface LoadingSpinnerProps {
  fullPage?: boolean;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ fullPage, size = "md" }: LoadingSpinnerProps) {
  const dotSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2.5 h-2.5",
    lg: "w-3.5 h-3.5",
  };

  const gapSizes = {
    sm: "gap-1",
    md: "gap-1.5",
    lg: "gap-2",
  };

  const spinner = (
    <div className={`flex items-center ${gapSizes[size]}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`${dotSizes[size]} rounded-full bg-primary-500`}
          style={{
            animation: "bounceLoader 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounceLoader {
          0%, 80%, 100% {
            transform: scale(0.4);
            opacity: 0.3;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        {spinner}
      </div>
    );
  }

  return spinner;
}
