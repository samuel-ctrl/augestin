import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LoadingSpinner,
  EmptyState,
  ConfirmDialog,
  Toast,
  useToast,
  extractErrorMessage,
  Button,
  PageHeader,
} from "@shared";
import type { TestSet, PaginatedResponse, TableQueryParams } from "@shared";
import api from "../../api/client";

export default function TestSetList() {
  const navigate = useNavigate();
  const [testSets, setTestSets] = useState<TestSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestSet | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchTestSets = useCallback(async () => {
    setError(null);
    try {
      const params: TableQueryParams = {
        page,
        page_size: pageSize,
        search: "",
        sort_by: "created_at",
        sort_order: "desc",
      };
      const res = await api.get<PaginatedResponse<TestSet>>("/test-sets", { params });
      setTestSets(res.data.items);
      setTotal(res.data.total);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to load test sets."));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchTestSets();
  }, [fetchTestSets]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/test-sets/${deleteTarget.id}`);
      showSuccess(`Test Set "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      fetchTestSets();
    } catch (err) {
      setDeleteTarget(null);
      showApiError(err, "Failed to delete test set. Please try again.");
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => { setLoading(true); fetchTestSets(); } }}
      />
    );
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title="Test Sets"
        actions={
          <Button color="success" onClick={() => navigate("/test-sets/new")}>
            + New Test Set
          </Button>
        }
      />

      {testSets.length === 0 ? (
        <EmptyState
          icon={<span>📝</span>}
          title="No test sets yet"
          description="Create a new test set to get started."
          action={{
            label: "Create Test Set",
            onClick: () => navigate("/test-sets/new"),
          }}
        />
      ) : (
        <div className="space-y-3">
          {testSets.map((ts) => (
            <div
              key={ts.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {ts.name}
                  </h3>
                  {ts.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {ts.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">
                      {ts.file_count} file{ts.file_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <Button variant="ghost" color="primary" size="xs" onClick={() => navigate(`/test-sets/${ts.id}/files`)}>
                    Files
                  </Button>
                  <Button variant="ghost" color="primary" size="xs" onClick={() => navigate(`/test-sets/${ts.id}/assign`)}>
                    Assign
                  </Button>
                  <Button variant="ghost" color="primary" size="xs" onClick={() => navigate(`/test-sets/${ts.id}/submissions`)}>
                    Submissions
                  </Button>
                  <Button variant="ghost" color="primary" size="xs" onClick={() => navigate(`/test-sets/${ts.id}/edit`)}>
                    Edit
                  </Button>
                  <Button variant="ghost" color="danger" size="xs" onClick={() => setDeleteTarget(ts)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

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
      />
    </div>
  );
}
