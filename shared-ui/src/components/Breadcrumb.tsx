import React from "react";
import { Link } from "react-router-dom";
import type { BreadcrumbSegment } from "../types";

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
}

export function Breadcrumb({ segments }: BreadcrumbProps) {
  return (
    <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 overflow-x-auto whitespace-nowrap">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <React.Fragment key={index}>
            {index > 0 && <span className="mx-2 text-gray-300 dark:text-gray-600">/</span>}
            {isLast || !segment.path ? (
              <span className={isLast ? "text-gray-900 dark:text-gray-100 font-medium" : ""}>
                {segment.label}
              </span>
            ) : (
              <Link
                to={segment.path}
                className="hover:text-primary-600 transition-colors"
              >
                {segment.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
