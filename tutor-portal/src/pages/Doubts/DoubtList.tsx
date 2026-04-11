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
      />
    </div>
  );
}
