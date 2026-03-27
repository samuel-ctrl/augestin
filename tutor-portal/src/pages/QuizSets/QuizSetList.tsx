import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LoadingSpinner,
  EmptyState,
  ConfirmDialog,
  Toast,
  useToast,
  extractErrorMessage,
} from "@shared";
import type { QuizSet, Subject, PaginatedResponse, TableQueryParams } from "@shared";
import api from "../../api/client";

export default function QuizSetList() {
  const navigate = useNavigate();
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuizSet | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await api.get("/subjects", {
        params: { page: 1, page_size: 100 },
      });
      setSubjects(res.data.items);
    } catch (err) {
      console.error("Failed to load subjects:", err);
    }
  }, []);

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
      if (subjectFilter) {
        params.subject_id = subjectFilter;
      }
      const res = await api.get("/quiz-sets", { params });
      setQuizSets(res.data.items);
      setTotal(res.data.total);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to load quiz sets."));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, subjectFilter]);

  useEffect(() => {
    fetchSubjects();
    fetchQuizSets();
  }, [fetchSubjects, fetchQuizSets]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/quiz-sets/${deleteTarget.id}`);
      showSuccess(`Quiz Set "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      fetchQuizSets();
    } catch (err) {
      setDeleteTarget(null);
      showApiError(err, "Failed to delete quiz set. Please try again.");
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Quiz Sets</h1>
        <button
          onClick={() => navigate("/quiz-sets/new")}
          className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
        >
          + New Quiz Set
        </button>
      </div>

      {/* Subject Filter */}
      <div className="mb-6 flex gap-3">
        <select
          value={subjectFilter}
          onChange={(e) => {
            setSubjectFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

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
              <div className="flex items-start justify-between">
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
                    <span className="text-xs text-gray-500">
                      {subjects.find((s) => s.id === qs.subject_id)?.name ||
                        "Unknown Subject"}
                    </span>
                    <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs rounded">
                      {qs.question_count} Q{qs.question_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => navigate(`/quiz-sets/${qs.id}/questions`)}
                    className="text-xs text-primary-500 hover:text-primary-700"
                  >
                    Questions
                  </button>
                  <button
                    onClick={() => navigate(`/quiz-sets/${qs.id}/assign`)}
                    className="text-xs text-primary-500 hover:text-primary-700"
                  >
                    Assign
                  </button>
                  <button
                    onClick={() => navigate(`/quiz-sets/${qs.id}/edit`)}
                    className="text-xs text-primary-500 hover:text-primary-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(qs)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
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
        message="Are you sure you want to delete this quiz set? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
