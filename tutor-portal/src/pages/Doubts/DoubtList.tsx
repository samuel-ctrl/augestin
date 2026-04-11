import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  DataTable, Toast, useToast, PageHeader,
} from "@shared";
import type { Doubt, ColumnDef, FilterDef, PaginatedResponse, TableQueryParams } from "@shared";
import api from "../../api/client";
import { useLookups } from "../../context/LookupContext";

const statusColors: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};

export default function DoubtList() {
  const navigate = useNavigate();
  const { standards, sections } = useLookups();
  const { toast, dismiss } = useToast();

  const fetchDoubts = useCallback(async (params: TableQueryParams): Promise<PaginatedResponse<Doubt>> => {
    const res = await api.get<PaginatedResponse<Doubt>>("/doubts", { params });
    return res.data;
  }, []);

  const columns: ColumnDef<Doubt>[] = [
    { key: "title", label: "Title", sortable: true },
    { key: "student_name", label: "Student", sortable: false },
    {
      key: "status",
      label: "Status",
      sortable: false,
      width: "110px",
      render: (val) => (
        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[val as string] || "bg-gray-100 text-gray-600"}`}>
          {val as string}
        </span>
      ),
    },
    {
      key: "book_title",
      label: "Book",
      sortable: false,
      render: (val) => (val ? String(val) : "—"),
    },
    {
      key: "comment_count",
      label: "Comments",
      sortable: false,
      width: "100px",
    },
    {
      key: "created_at",
      label: "Date",
      sortable: true,
      width: "110px",
      render: (val) => new Date(val as string).toLocaleDateString(),
    },
  ];

  const filters: FilterDef[] = [
    {
      key: "status",
      label: "All Status",
      options: [
        { value: "open", label: "Open" },
        { value: "resolved", label: "Resolved" },
        { value: "closed", label: "Closed" },
      ],
    },
    {
      key: "standard",
      label: "All Standards",
      options: standards,
    },
    {
      key: "section",
      label: "All Sections",
      options: sections,
    },
  ];

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader title="Doubt Hub" />

      <DataTable<Doubt>
        fetchFn={fetchDoubts}
        columns={columns}
        filters={filters}
        searchPlaceholder="Search doubts..."
        defaultSortBy="created_at"
        defaultSortOrder="desc"
        rowKey={(d) => d.id}
        onRowClick={(d) => navigate(`/doubts/${d.id}`)}
        renderCard={(row) => (
          <div
            className="bg-[rgb(191_189_207_/_38%)] rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/doubts/${row.id}`)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[row.status] || "bg-gray-100 text-gray-600"}`}>
                {row.status}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(row.created_at).toLocaleDateString()}
              </span>
            </div>
            <h4 className="font-medium text-gray-800 text-sm line-clamp-2">{row.title}</h4>
            <p className="text-xs text-gray-500 mt-1">{row.student_name}</p>
            {row.book_title && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{row.book_title}</p>
            )}
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {row.comment_count}
            </div>
          </div>
        )}
      />
    </div>
  );
}
