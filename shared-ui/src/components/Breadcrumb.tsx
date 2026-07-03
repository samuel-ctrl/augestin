import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { BreadcrumbSegment } from "../types";

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
  variant?: "default" | "light";
}

const variantStyles = {
  default: {
    nav: "text-gray-500 dark:text-gray-400",
    separator: "text-gray-300 dark:text-gray-600",
    active: "text-gray-900 dark:text-gray-100 font-medium",
    link: "hover:text-primary-600 transition-colors",
  },
  light: {
    nav: "text-blue-200",
    separator: "text-blue-300/50",
    active: "text-white font-medium",
    link: "text-blue-200 hover:text-white transition-colors",
  },
};

export function Breadcrumb({ segments, variant = "default" }: BreadcrumbProps) {
  const styles = variantStyles[variant];

  return (
    <nav className={`flex items-center text-sm overflow-x-auto whitespace-nowrap ${styles.nav}`}>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <React.Fragment key={index}>
            {index > 0 && <ChevronRight className={`mx-1.5 w-3.5 h-3.5 shrink-0 ${styles.separator}`} />}
            {isLast || !segment.path ? (
              <span className={isLast ? styles.active : ""}>{segment.label}</span>
            ) : (
              <Link to={segment.path} className={styles.link}>
                {segment.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
