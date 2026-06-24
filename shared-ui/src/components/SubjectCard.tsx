import React from "react";
import { iconMap } from "../constants/icons";
import { DropdownMenu } from "./DropdownMenu";
import type { DropdownMenuItem } from "./DropdownMenu";

interface SubjectCardProps {
  name: string;
  icon: string;
  bookCount: number;
  onClick?: () => void;
  actions?: React.ReactNode;
  menuItems?: DropdownMenuItem[];
}

export function SubjectCard({
  name,
  icon,
  bookCount,
  onClick,
  actions,
  menuItems,
}: SubjectCardProps) {
  return (
    <div
      className={`group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-5 transition-all duration-200 hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-700 hover:-translate-y-0.5 ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-400 to-primary-600 rounded-t-xl opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-2xl mb-3">
          {iconMap[icon] || iconMap.book}
        </div>
        {menuItems && menuItems.length > 0 && (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu items={menuItems} />
          </div>
        )}
        {!menuItems && actions && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          >
            {actions}
          </div>
        )}
      </div>
      <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1 truncate" title={name}>
        {name}
      </h3>
      <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        {bookCount} {bookCount === 1 ? "book" : "books"}
      </div>
    </div>
  );
}
