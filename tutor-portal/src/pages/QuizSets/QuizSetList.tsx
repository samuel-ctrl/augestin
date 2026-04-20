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
import type { QuizSet, ColumnDef, PaginatedResponse, TableQueryParams, DropdownMenuItem } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";

const DEFAULT_THUMBNAIL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200' fill='%23e5e7eb'%3E%3Crect width='300' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='40'%3E%F0%9F%93%96%3C/text%3E%3C/svg%3E";

export default function QuizSetList() {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<QuizSet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchQuizSets = useCallback(async (params: TableQueryParams): Promise<PaginatedResponse<QuizSet>> => {
    const res = await api.get("/quiz-sets", { params });
    return res.data;
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/quiz-sets/${deleteTarget.id}`);
      showSuccess(`Quiz Set "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showApiError(err, "Failed to delete quiz set.");
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<QuizSet>[] = [
    { key: "name", label: "Name", sortable: true },
    {
      key: "question_count",
      label: "Questions",
      sortable: false,
      width: "120px",
      render: (val) => `${val} Q${val !== 1 ? "s" : ""}`,
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
      <PageHeader title="Quizzes" />

      <DataTable<QuizSet>
        key={refreshKey}
        fetchFn={fetchQuizSets}
        columns={columns}
        searchPlaceholder="Search quizzes..."
        defaultSortBy="created_at"
        defaultSortOrder="desc"
        rowKey={(qs) => qs.id}
        addButtonLabel="+ New Quiz Set"
        onAddClick={() => navigate("/quiz-sets/new")}
        actions={(row): DropdownMenuItem[] => [
          { label: "Questions", onClick: () => navigate(`/quiz-sets/${row.id}/questions`) },
          { label: "Assign", onClick: () => navigate(`/quiz-sets/${row.id}/assign`) },
          { label: "Leaderboard", onClick: () => navigate(`/quiz-sets/${row.id}/leaderboard`) },
          { label: "Edit", onClick: () => navigate(`/quiz-sets/${row.id}/edit`) },
          { label: "Delete", onClick: () => setDeleteTarget(row), variant: "danger" },
        ]}
        renderCard={(row, cardActions) => (
          <div
            className="bg-[rgb(191_189_207_/_38%)] rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/quiz-sets/${row.id}/questions`)}
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
                  {row.question_count} Q{row.question_count !== 1 ? "s" : ""}
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
