import React from "react";

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function TablePagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="text-sm text-white">
        Showing {start}–{end} of {total}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-gray-500 rounded px-2 py-1 text-sm bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size} className="text-gray-800 bg-white">
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 text-sm text-white border border-gray-500 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-sm text-white">
            Page {page} of {totalPages || 1}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm text-white border border-gray-500 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
