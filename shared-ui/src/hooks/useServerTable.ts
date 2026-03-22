import { useState, useEffect, useCallback, useRef } from "react";
import type { PaginatedResponse, TableQueryParams } from "../types";
import { extractErrorMessage } from "./useToast";

interface UseServerTableOptions<T> {
  fetchFn: (params: TableQueryParams) => Promise<PaginatedResponse<T>>;
  defaultSortBy?: string;
  defaultSortOrder?: "asc" | "desc";
  defaultPageSize?: number;
  defaultFilters?: Record<string, string>;
}

interface UseServerTableReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  search: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  filters: Record<string, string>;
  handlers: {
    setSearch: (search: string) => void;
    setPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;
    setSortBy: (sortBy: string) => void;
    toggleSort: (column: string) => void;
    setFilter: (key: string, value: string) => void;
    refresh: () => void;
  };
}

export function useServerTable<T>(
  options: UseServerTableOptions<T>
): UseServerTableReturn<T> {
  const {
    fetchFn,
    defaultSortBy = "created_at",
    defaultSortOrder = "desc",
    defaultPageSize = 20,
    defaultFilters = {},
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [search, setSearchState] = useState("");
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(defaultSortOrder);
  const [filters, setFilters] = useState<Record<string, string>>(defaultFilters);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const params: TableQueryParams = {
          page,
          page_size: pageSize,
          search,
          sort_by: sortBy,
          sort_order: sortOrder,
          ...filters,
        };

        const response = await fetchFnRef.current(params);

        if (!cancelled) {
          setData(response.items);
          setTotal(response.total);
          setTotalPages(response.total_pages);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(extractErrorMessage(err, "Failed to fetch data"));
          setData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, search, sortBy, sortOrder, filters, refreshKey]);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);

  const handleSetPageSize = useCallback((value: number) => {
    setPageSize(value);
    setPage(1);
  }, []);

  const toggleSort = useCallback(
    (column: string) => {
      if (sortBy === column) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(column);
        setSortOrder("asc");
      }
      setPage(1);
    },
    [sortBy]
  );

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => {
      if (value === "") {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return {
    data,
    loading,
    error,
    pagination: { page, pageSize, total, totalPages },
    search,
    sortBy,
    sortOrder,
    filters,
    handlers: {
      setSearch,
      setPage,
      setPageSize: handleSetPageSize,
      setSortBy: (column: string) => {
        setSortBy(column);
        setPage(1);
      },
      toggleSort,
      setFilter,
      refresh,
    },
  };
}
