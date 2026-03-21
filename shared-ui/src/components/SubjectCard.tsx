import React from "react";
import { iconMap } from "../constants/icons";

interface SubjectCardProps {
  name: string;
  icon: string;
  bookCount: number;
  onClick?: () => void;
  actions?: React.ReactNode;
}

export function SubjectCard({
  name,
  icon,
  bookCount,
  onClick,
  actions,
}: SubjectCardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-5 transition-shadow hover:shadow-md ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="text-3xl mb-3">{iconMap[icon] || iconMap.book}</div>
        {actions && (
          <div onClick={(e) => e.stopPropagation()}>{actions}</div>
        )}
      </div>
      <h3 className="font-semibold text-gray-800 mb-1 truncate">{name}</h3>
      <p className="text-sm text-gray-400">
        {bookCount} {bookCount === 1 ? "book" : "books"}
      </p>
    </div>
  );
}
