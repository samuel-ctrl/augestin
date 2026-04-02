import React, { useState, useRef, useEffect } from "react";
import { iconMap, iconKeys } from "../constants/icons";

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm w-full"
      >
        <span className="text-xl">{iconMap[value] || iconMap.book}</span>
        <span className="text-gray-600 capitalize">{value || "Select icon"}</span>
        <svg className="ml-auto h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-full max-h-60 overflow-y-auto">
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {iconKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={`flex flex-col items-center p-2 rounded-lg text-xs transition-colors ${
                  value === key
                    ? "bg-primary-50 ring-2 ring-primary-500"
                    : "hover:bg-gray-50"
                }`}
                title={key}
              >
                <span className="text-xl mb-1">{iconMap[key]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
