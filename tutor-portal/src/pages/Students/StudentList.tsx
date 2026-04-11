import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { DataTable, ConfirmDialog, Toast, useToast, extractErrorMessage, PageHeader, DropdownMenu } from "@shared";
import type { Student, ColumnDef, PaginatedResponse, TableQueryParams, DropdownMenuItem } from "@shared";
import api from "../../api/client";
import { useLookups } from "../../context/LookupContext";

const columns: ColumnDef<Student>[] = [
  { key: "name", label: "Name" },
  { key: "login_id", label: "Login ID" },
  {
    key: "standard",
    label: "Standard",
    render: (v) => (v ? `${v}th` : "\u2014"),
  },
  {
    key: "section",
    label: "Section",
    render: (v) => (v ? String(v) : "\u2014"),
  },
  {
    key: "assignment_count",
    label: "Assignments",
    render: (v) => String(v ?? 0),
  },
  {
    key: "created_at",
    label: "Created",
    render: (v) =>
      v ? new Date(v as string).toLocaleDateString() : "\u2014",
  },
];

export default function StudentList() {
  const navigate = useNavigate();
  const { standards, sections } = useLookups();

  const filters = [
    { key: "standard", label: "Standard", options: standards },
    { key: "section", label: "Section", options: sections },
  ];
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchStudents = async (
    params: TableQueryParams
  ): Promise<PaginatedResponse<Student>> => {
    const res = await api.get("/students", { params });
    return res.data;
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/students/${deleteTarget.id}`);
      setDeleteTarget(null);
      showSuccess(`Student "${deleteTarget.name}" deleted successfully.`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showApiError(err, "Failed to delete student. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader title="Students" />

      <DataTable<Student>
        key={refreshKey}
        fetchFn={fetchStudents}
        columns={columns}
        filters={filters}
        searchPlaceholder="Search by name, login ID..."
        defaultSortBy="created_at"
        onRowClick={(student) => navigate(`/students/${student.id}`)}
        rowKey={(s) => s.id}
        addButtonLabel="+ Add Student"
        onAddClick={() => navigate("/students/new")}
        actions={(student): DropdownMenuItem[] => [
          { label: "Delete", onClick: () => setDeleteTarget(student), variant: "danger" },
        ]}
        renderCard={(row, cardActions) => (
          <div
            className="bg-[rgb(191_189_207_/_38%)] rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/students/${row.id}`)}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-800 text-sm truncate">{row.name}</h4>
              {cardActions && (
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu items={cardActions} />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{row.login_id}</p>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {row.standard && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                  Std: {row.standard}
                </span>
              )}
              {row.section && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                  {row.section}
                </span>
              )}
              <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs rounded">
                {row.assignment_count} assignment{row.assignment_count !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Student"
        alertMessage="This will permanently remove the student and all their assignments, progress, and data."
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        variant="danger"
        countdownSeconds={5}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
