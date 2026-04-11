import React from "react";
import type {
  PaginatedResponse,
  TableQueryParams,
  ColumnDef,
  FilterDef,
} from "../../types";
import { useServerTable } from "../../hooks/useServerTable";
import { TableSearch } from "./TableSearch";
import { TableFilters } from "./TableFilters";
import { TableSortHeader } from "./TableSortHeader";
import { TablePagination } from "./TablePagination";
import { LoadingSpinner } from "../LoadingSpinner";
import { Button } from "../Button";
import { DropdownMenu } from "../DropdownMenu";
import type { DropdownMenuItem } from "../DropdownMenu";

interface DataTableProps<T> {
  fetchFn: (params: TableQueryParams) => Promise<PaginatedResponse<T>>;
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  filters?: FilterDef[];
  defaultSortBy?: string;
  defaultSortOrder?: "asc" | "desc";
  defaultPageSize?: number;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => DropdownMenuItem[];
  rowKey?: (row: T) => string;
  addButtonLabel?: string;
  onAddClick?: () => void;
  renderCard?: (row: T, actions?: DropdownMenuItem[]) => React.ReactNode;
}

// Fixed height: header (~40px) + 6 rows (~48px each) + buffer
const TABLE_MAX_HEIGHT = "20.5rem";


export function DataTable<T>({
  fetchFn,
  columns,
  searchPlaceholder,
  filters: filterDefs,
  defaultSortBy,
  defaultSortOrder,
  defaultPageSize,
  onRowClick,
  actions,
  rowKey,
  addButtonLabel,
  onAddClick,
  renderCard,
}: DataTableProps<T>) {
  const [viewMode, setViewMode] = React.useState<"table" | "card">("table");

  const {
    data,
    loading,
    error,
    pagination,
    search,
    sortBy,
    sortOrder,
    filters,
    handlers,
  } = useServerTable<T>({
    fetchFn,
    defaultSortBy,
    defaultSortOrder,
    defaultPageSize,
  });

  // Insert actions column at position 3 (index 2), or at end if fewer columns
  const ACTION_COL_INDEX = Math.min(2, columns.length);
  const totalCols = columns.length + (actions ? 1 : 0);

  const renderHeaderCells = () => {
    const cells: React.ReactNode[] = [];
    columns.forEach((col, i) => {
      if (actions && i === ACTION_COL_INDEX) {
        cells.push(
          <th key="__actions" className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider w-16">
            Actions
          </th>
        );
      }
      cells.push(
        <TableSortHeader
          key={col.key}
          label={col.label}
          column={col.key}
          currentSortBy={sortBy}
          currentSortOrder={sortOrder}
          sortable={col.sortable !== false}
          onToggleSort={handlers.toggleSort}
          width={col.width}
          dark
        />
      );
    });
    // If action column goes at the end (columns.length <= 2)
    if (actions && ACTION_COL_INDEX === columns.length) {
      cells.push(
        <th key="__actions" className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider w-16">
          Actions
        </th>
      );
    }
    return cells;
  };

  const renderRowCells = (row: T) => {
    const cells: React.ReactNode[] = [];
    columns.forEach((col, i) => {
      if (actions && i === ACTION_COL_INDEX) {
        cells.push(
          <td
            key="__actions"
            className="px-4 py-3.5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu items={actions(row)} />
          </td>
        );
      }
      const value = (row as Record<string, unknown>)[col.key];
      cells.push(
        <td
          key={col.key}
          className="px-4 py-3.5 text-sm text-gray-800"
          style={col.width ? { width: col.width } : undefined}
        >
          {col.render ? col.render(value, row) : String(value ?? "—")}
        </td>
      );
    });
    if (actions && ACTION_COL_INDEX === columns.length) {
      cells.push(
        <td
          key="__actions"
          className="px-4 py-3.5 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu items={actions(row)} />
        </td>
      );
    }
    return cells;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-t-xl" style={{ backgroundColor: "rgb(44, 62, 80)" }}>
        <div className="w-full sm:max-w-sm">
          <TableSearch
            value={search}
            onChange={handlers.setSearch}
            placeholder={searchPlaceholder}
          />
        </div>
        {filterDefs && filterDefs.length > 0 && (
          <TableFilters
            filters={filterDefs}
            values={filters}
            onChange={handlers.setFilter}
          />
        )}
        {renderCard && (
          <div className={`flex border border-gray-500 rounded-lg overflow-hidden ${!addButtonLabel ? "sm:ml-auto" : "sm:ml-auto"}`}>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 transition-colors ${
                viewMode === "table"
                  ? "bg-white/20 text-white"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
              title="Table view"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="3" width="14" height="2" rx="0.5" fill="currentColor"/>
                <rect x="2" y="8" width="14" height="2" rx="0.5" fill="currentColor"/>
                <rect x="2" y="13" width="14" height="2" rx="0.5" fill="currentColor"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode("card")}
              className={`p-2 transition-colors ${
                viewMode === "card"
                  ? "bg-white/20 text-white"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
              title="Card view"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="10" y="2" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="2" y="10" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="10" y="10" width="6" height="6" rx="1" fill="currentColor"/>
              </svg>
            </button>
          </div>
        )}
        {addButtonLabel && onAddClick && (
          <Button color="success" size="md" className={`${renderCard ? "" : "sm:ml-auto "}whitespace-nowrap`} onClick={onAddClick}>
            {addButtonLabel}
          </Button>
        )}
      </div>

      {/* Data area */}
      {viewMode === "card" && renderCard ? (
        <div className="p-4" style={{ minHeight: "12rem" }}>
          {loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : error ? (
            <div className="text-center text-red-500 py-12">{error}</div>
          ) : data.length === 0 ? (
            <div className="text-center text-gray-400 py-12">No results found</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.map((row, idx) => (
                <div key={rowKey ? rowKey(row) : idx}>
                  {renderCard(row, actions ? actions(row) : undefined)}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: TABLE_MAX_HEIGHT, scrollbarWidth: "thin", scrollbarColor: "rgba(44,62,80,0.35) transparent" }}>
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: "rgb(44, 62, 80)", borderTop: "1.5px solid white" }}>
                {renderHeaderCells()}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={totalCols}
                    className="px-4 py-12 text-center"
                  >
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={totalCols}
                    className="px-4 py-12 text-center text-red-500"
                  >
                    {error}
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={totalCols}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No results found
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr
                    key={rowKey ? rowKey(row) : idx}
                    className={`${onRowClick ? "cursor-pointer" : ""} hover:bg-gray-50 transition-colors duration-150`}
                    style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "rgb(226 226 226 / 85%)" }}
                    onClick={() => onRowClick?.(row)}
                  >
                    {renderRowCells(row)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="rounded-b-xl" style={{ backgroundColor: "rgb(44, 62, 80)" }}>
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={handlers.setPage}
          onPageSizeChange={handlers.setPageSize}
        />
      </div>
    </div>
  );
}
