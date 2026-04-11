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
}: DataTableProps<T>) {
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
        {addButtonLabel && onAddClick && (
          <Button color="success" size="md" className="sm:ml-auto whitespace-nowrap" onClick={onAddClick}>
            {addButtonLabel}
          </Button>
        )}
      </div>

      {/* Table */}
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
