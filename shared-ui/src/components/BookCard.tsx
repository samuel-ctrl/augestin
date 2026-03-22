import React from "react";
import { ProgressBar } from "./ProgressBar";

interface BookCardProps {
  title: string;
  standard: string;
  thumbnailUrl?: string;
  watchPercentage?: number;
  completed?: boolean;
  questionCount?: number;
  onClick?: () => void;
  actions?: React.ReactNode;
}

const DEFAULT_THUMBNAIL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200' fill='%23e5e7eb'%3E%3Crect width='300' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='40'%3E%F0%9F%93%96%3C/text%3E%3C/svg%3E";

export function BookCard({
  title,
  standard,
  thumbnailUrl,
  watchPercentage,
  completed,
  questionCount,
  onClick,
  actions,
}: BookCardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 overflow-hidden transition-shadow hover:shadow-md ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <div className="relative aspect-video bg-gray-100">
        <img
          src={thumbnailUrl || DEFAULT_THUMBNAIL}
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_THUMBNAIL;
          }}
        />
        {completed && (
          <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
            ✓
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-gray-800 text-sm truncate flex-1">{title}</h4>
          {actions && (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              {actions}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
            Std: {standard}
          </span>
          {questionCount !== undefined && questionCount > 0 && (
            <span className="inline-block px-2 py-0.5 bg-primary-50 text-primary-600 text-xs rounded">
              {questionCount} Q{questionCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {watchPercentage !== undefined && (
          <div className="mt-2">
            <ProgressBar percentage={watchPercentage} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}
