import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { DataTable, ConfirmDialog, Toast, useToast, extractErrorMessage, standardOptions, Button, PageHeader } from "@shared";
import type { Student, ColumnDef, PaginatedResponse, TableQueryParams } from "@shared";
import api from "../../api/client";

const columns: ColumnDef<Student>[] = [
  { key: "name", label: "Name" },
  { key: "login_id", label: "Login ID" },
  {
    key: "standard",
    label: "Standard",
    render: (v) => (v ? `${v}th` : "\u2014"),
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

const filters = [
  { key: "standard", label: "Standard", options: standardOptions },
];

export default function StudentList() {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
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
    try {
      await api.delete(`/students/${deleteTarget.id}`);
      setDeleteTarget(null);
      showSuccess(`Student "${deleteTarget.name}" deleted successfully.`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setDeleteTarget(null);
      showApiError(err, "Failed to delete student. Please try again.");
    }
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title="Students"
        actions={
          <Button color="success" onClick={() => navigate("/students/new")}>
            + Add Student
          </Button>
        }
      />

      <DataTable<Student>
        key={refreshKey}
        fetchFn={fetchStudents}
        columns={columns}
        filters={filters}
        searchPlaceholder="Search by name, login ID..."
        defaultSortBy="created_at"
        onRowClick={(student) => navigate(`/students/${student.id}`)}
        rowKey={(s) => s.id}
        actions={(student) => (
          <Button variant="ghost" color="danger" size="xs" onClick={() => setDeleteTarget(student)}>
            Delete
          </Button>
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
      />
    </div>
  );
}
