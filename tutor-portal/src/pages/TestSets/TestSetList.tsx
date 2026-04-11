import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  DataTable,
  ConfirmDialog,
  Toast,
  useToast,
  PageHeader,
  DropdownMenu,
} from "@shared";
import type { TestSet, ColumnDef, PaginatedResponse, TableQueryParams, DropdownMenuItem } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";

const DEFAULT_THUMBNAIL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200' fill='%23e5e7eb'%3E%3Crect width='300' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='40'%3E%F0%9F%93%96%3C/text%3E%3C/svg%3E";

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
        renderCard={(row, cardActions) => (
          <div
            className="bg-[rgb(191_189_207_/_38%)] rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/test-sets/${row.id}/files`)}
          >
            <div className="relative aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
              <img
                src={row.thumbnail_url ? assetUrl(row.thumbnail_url) : DEFAULT_THUMBNAIL}
                alt={row.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_THUMBNAIL; }}
              />
            </div>
            <div className="p-3">
              <h4 className="font-medium text-gray-800 text-sm truncate">{row.name}</h4>
              <div className="flex items-center justify-between mt-1">
                <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs rounded">
                  {row.file_count} file{row.file_count !== 1 ? "s" : ""}
                </span>
                {cardActions && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu items={cardActions} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
