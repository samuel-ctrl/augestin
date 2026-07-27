import React from "react";
import { toDriveThumbnailUrl } from "../utils/googleDrive";
import { BookThumbnail } from "./BookThumbnail";

interface BookCardProps {
  title: string;
  standard: string;
  thumbnailUrl?: string;
  topicCount?: number;
  onClick?: () => void;
  actions?: React.ReactNode;
}

export function BookCard({
  title,
  standard,
  thumbnailUrl,
  topicCount,
  onClick,
  actions,
}: BookCardProps) {
  const resolvedSrc = thumbnailUrl ? toDriveThumbnailUrl(thumbnailUrl) : thumbnailUrl;

  return (
    <div
      className={`bg-[rgb(191_189_207_/_38%)] dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-shadow hover:shadow-md ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <BookThumbnail src={resolvedSrc} alt={title} className="aspect-video rounded-t-lg" />
      <div className="p-3">
        <h4 className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate">{title}</h4>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
            Std: {standard}
          </span>
          {topicCount !== undefined && topicCount > 0 && (
            <span className="inline-block px-2 py-0.5 bg-primary-50 text-primary-600 text-xs rounded">
              {topicCount} Topic{topicCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {actions && (
          <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-end mt-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
