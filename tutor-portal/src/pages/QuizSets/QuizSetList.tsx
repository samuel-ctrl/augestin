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
import type { QuizSet, PaginatedResponse, TableQueryParams } from "@shared";
import api from "../../api/client";

export default function QuizSetList() {
  const navigate = useNavigate();
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuizSet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchQuizSets = useCallback(async () => {
    setError(null);
    try {
      const params: TableQueryParams = {
        page,
        page_size: pageSize,
        search: "",
        sort_by: "created_at",
        sort_order: "desc",
      };
      const res = await api.get("/quiz-sets", { params });
      setQuizSets(res.data.items);
      setTotal(res.data.total);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to load quiz sets."));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchQuizSets();
  }, [fetchQuizSets]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/quiz-sets/${deleteTarget.id}`);
      showSuccess(`Quiz Set "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      fetchQuizSets();
    } catch (err) {
      showApiError(err, "Failed to delete quiz set. Please try again.");
    } finally {
      setDeleting(false);
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
        action={{ label: "Try Again", onClick: () => { setLoading(true); fetchQuizSets(); } }}
      />
    );
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title="Quiz Sets"
        actions={
          <Button color="success" onClick={() => navigate("/quiz-sets/new")}>
            + New Quiz Set
          </Button>
        }
      />

      {/* Quiz Sets List */}
      {quizSets.length === 0 ? (
        <EmptyState
          icon={<span>🧩</span>}
          title="No quiz sets yet"
          description="Create a new quiz set to get started."
          action={{
            label: "Create Quiz Set",
            onClick: () => navigate("/quiz-sets/new"),
          }}
        />
      ) : (
        <div className="space-y-3">
          {quizSets.map((qs) => (
            <div
              key={qs.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {qs.name}
                  </h3>
                  {qs.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {qs.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs rounded">
                      {qs.question_count} Q{qs.question_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button variant="ghost" color="primary" size="xs" onClick={() => navigate(`/quiz-sets/${qs.id}/questions`)}>
                    Questions
                  </Button>
                  <Button variant="ghost" color="primary" size="xs" onClick={() => navigate(`/quiz-sets/${qs.id}/assign`)}>
                    Assign
                  </Button>
                  <Button variant="ghost" color="primary" size="xs" onClick={() => navigate(`/quiz-sets/${qs.id}/edit`)}>
                    Edit
                  </Button>
                  <Button variant="ghost" color="danger" size="xs" onClick={() => setDeleteTarget(qs)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
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
        title="Delete Quiz Set"
        alertMessage="This action cannot be undone."
        message="Are you sure you want to delete this quiz set?"
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
