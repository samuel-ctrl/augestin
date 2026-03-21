import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { DataTable, ConfirmDialog, standardOptions } from "@shared";
import type { Student, ColumnDef, PaginatedResponse, TableQueryParams } from "@shared";
import api from "../../api/client";

const columns: ColumnDef<Student>[] = [
  { key: "name", label: "Name" },
  { key: "login_id", label: "Login ID" },
  {
    key: "standard",
    label: "Standard",
    render: (v) => (v ? `${v}th` : "—"),
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
      v ? new Date(v as string).toLocaleDateString() : "—",
  },
];

const filters = [
  { key: "standard", label: "Standard", options: standardOptions },
];

export default function StudentList() {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchStudents = async (
    params: TableQueryParams
  ): Promise<PaginatedResponse<Student>> => {
    const res = await api.get("/students", { params });
    return res.data;
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.delete(`/students/${deleteTarget.id}`);
    setDeleteTarget(null);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Students</h1>
        <button
          onClick={() => navigate("/students/new")}
          className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Add Student
        </button>
      </div>

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
          <button
            onClick={() => setDeleteTarget(student)}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            Delete
          </button>
        )}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Student"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also remove all their assignments and progress.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
