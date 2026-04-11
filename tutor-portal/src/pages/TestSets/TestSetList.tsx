import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  DataTable,
  ConfirmDialog,
  Toast,
  useToast,
  PageHeader,
} from "@shared";
import type { TestSet, ColumnDef, PaginatedResponse, TableQueryParams, DropdownMenuItem } from "@shared";
import api from "../../api/client";

export default function TestSetList() {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<TestSet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchTestSets = useCallback(async (params: TableQueryParams): Promise<PaginatedResponse<TestSet>> => {
    const res = await api.get("/test-sets", { params });
    return res.data;
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/test-sets/${deleteTarget.id}`);
      showSuccess(`Test Set "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showApiError(err, "Failed to delete test set.");
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<TestSet>[] = [
    { key: "name", label: "Name", sortable: true },
    {
      key: "file_count",
      label: "Files",
      sortable: false,
      width: "100px",
      render: (val) => `${val} file${val !== 1 ? "s" : ""}`,
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      width: "150px",
      render: (val) => val ? new Date(val as string).toLocaleDateString() : "—",
    },
  ];

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader title="Test Module" />

      <DataTable<TestSet>
        key={refreshKey}
        fetchFn={fetchTestSets}
        columns={columns}
        searchPlaceholder="Search test sets..."
        defaultSortBy="created_at"
        defaultSortOrder="desc"
        rowKey={(ts) => ts.id}
        addButtonLabel="+ New Test Set"
        onAddClick={() => navigate("/test-sets/new")}
        actions={(row): DropdownMenuItem[] => [
          { label: "Files", onClick: () => navigate(`/test-sets/${row.id}/files`) },
          { label: "Assign", onClick: () => navigate(`/test-sets/${row.id}/assign`) },
          { label: "Submissions", onClick: () => navigate(`/test-sets/${row.id}/submissions`) },
          { label: "Edit", onClick: () => navigate(`/test-sets/${row.id}/edit`) },
          { label: "Delete", onClick: () => setDeleteTarget(row), variant: "danger" },
        ]}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Test Set"
        alertMessage="This action cannot be undone."
        message="Are you sure you want to delete this test set?"
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
