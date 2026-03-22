import React from "react";
import { iconMap } from "../constants/icons";

const colorThemes = [
  {
    bg: "from-blue-500/10 to-indigo-500/15",
    border: "border-blue-200 hover:border-blue-300",
    iconBg: "bg-blue-500/15",
    iconRing: "ring-blue-500/20",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-600",
    arrow: "text-blue-400 group-hover:text-blue-600",
  },
  {
    bg: "from-emerald-500/10 to-teal-500/15",
    border: "border-emerald-200 hover:border-emerald-300",
    iconBg: "bg-emerald-500/15",
    iconRing: "ring-emerald-500/20",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-600",
    arrow: "text-emerald-400 group-hover:text-emerald-600",
  },
  {
    bg: "from-orange-500/10 to-amber-500/15",
    border: "border-orange-200 hover:border-orange-300",
    iconBg: "bg-orange-500/15",
    iconRing: "ring-orange-500/20",
    text: "text-orange-700",
    badge: "bg-orange-100 text-orange-600",
    arrow: "text-orange-400 group-hover:text-orange-600",
  },
  {
    bg: "from-purple-500/10 to-violet-500/15",
    border: "border-purple-200 hover:border-purple-300",
    iconBg: "bg-purple-500/15",
    iconRing: "ring-purple-500/20",
    text: "text-purple-700",
    badge: "bg-purple-100 text-purple-600",
    arrow: "text-purple-400 group-hover:text-purple-600",
  },
  {
    bg: "from-rose-500/10 to-pink-500/15",
    border: "border-rose-200 hover:border-rose-300",
    iconBg: "bg-rose-500/15",
    iconRing: "ring-rose-500/20",
    text: "text-rose-700",
    badge: "bg-rose-100 text-rose-600",
    arrow: "text-rose-400 group-hover:text-rose-600",
  },
  {
    bg: "from-cyan-500/10 to-sky-500/15",
    border: "border-cyan-200 hover:border-cyan-300",
    iconBg: "bg-cyan-500/15",
    iconRing: "ring-cyan-500/20",
    text: "text-cyan-700",
    badge: "bg-cyan-100 text-cyan-600",
    arrow: "text-cyan-400 group-hover:text-cyan-600",
  },
];

interface SubjectTileProps {
  name: string;
  icon: string;
  bookCount: number;
  colorIndex: number;
  onClick?: () => void;
  actions?: React.ReactNode;
}

export function SubjectTile({
  name,
  icon,
  bookCount,
  colorIndex,
  onClick,
  actions,
}: SubjectTileProps) {
  const theme = colorThemes[colorIndex % colorThemes.length];

  return (
    <div
      className={`group relative flex flex-col items-center text-center transition-all duration-200 hover:scale-[1.05] ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      {/* Actions */}
      {actions && (
        <div
          className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}

      {/* Round Icon */}
      <div
        className={`w-16 h-16 rounded-full bg-gradient-to-br ${theme.bg} border-2 ${theme.border} flex items-center justify-center text-2xl shadow-sm group-hover:shadow-md transition-shadow`}
      >
        {iconMap[icon] || iconMap.book}
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-800 mt-2 truncate max-w-[100px]" title={name}>
        {name}
      </h3>

      {/* Book count */}
      <span className={`text-xs font-medium ${theme.text} mt-0.5`}>
        {bookCount} {bookCount === 1 ? "book" : "books"}
      </span>
    </div>
  );
}
