import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, Toast, useToast, PageHeader, Button } from "@shared";
import type { AssignedQuizSet, ColumnDef, PaginatedResponse, TableQueryParams } from "@shared";
import api from "../../api/client";

const DEFAULT_THUMBNAIL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200' fill='%23e5e7eb'%3E%3Crect width='300' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='40'%3E%F0%9F%A7%A9%3C/text%3E%3C/svg%3E";

export default function QuizSetDashboard() {
  const navigate = useNavigate();
  const { toast, dismiss } = useToast();

  const fetchQuizSets = useCallback(async (params: TableQueryParams): Promise<PaginatedResponse<AssignedQuizSet>> => {
    const res = await api.get("/students/quiz-sets");
    const items: AssignedQuizSet[] = res.data.items || res.data;
    // Client-side pagination wrapper
    const start = (params.page - 1) * params.page_size;
    const paged = items.slice(start, start + params.page_size);
    return {
      items: paged,
      total: items.length,
      page: params.page,
      page_size: params.page_size,
      total_pages: Math.ceil(items.length / params.page_size),
    };
  }, []);

  const columns: ColumnDef<AssignedQuizSet>[] = [
    { key: "name", label: "Name", sortable: false },
    {
      key: "question_count",
      label: "Questions",
      sortable: false,
      width: "120px",
      render: (val) => `${val} Q${val !== 1 ? "s" : ""}`,
    },
    {
      key: "progress",
      label: "Progress",
      sortable: false,
      width: "100px",
      render: (_val, row) =>
        row.progress ? (
          <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs rounded">
            {row.progress.score_percentage}%
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
        ),
    },
  ];

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title="Quizzes"
        subtitle="Available quizzes assigned to you"
        actions={
          <Button color="primary" variant="outline" size="sm" onClick={() => navigate("/quiz-sets/live")}>
            Join Live Quiz
          </Button>
        }
      />

      <DataTable<AssignedQuizSet>
        fetchFn={fetchQuizSets}
        columns={columns}
        searchPlaceholder="Search quizzes..."
        rowKey={(qs) => qs.id}
        onRowClick={(qs) => navigate(`/quiz-sets/${qs.id}`)}
        renderCard={(row) => (
          <div
            className="bg-[rgb(191_189_207_/_38%)] rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg hover:border-primary-300 transition-all cursor-pointer"
            onClick={() => navigate(`/quiz-sets/${row.id}`)}
          >
            <div className="mb-3 h-32 bg-gray-200 dark:bg-gray-600 rounded overflow-hidden">
              <img
                src={row.thumbnail_url || DEFAULT_THUMBNAIL}
                alt={row.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_THUMBNAIL; }}
              />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-50 text-sm line-clamp-2">
              {row.name}
            </h3>
            {row.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{row.description}</p>}
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {row.question_count} Q{row.question_count !== 1 ? "s" : ""}
              </span>
              {row.progress && (
                <span className="text-xs px-2 py-0.5 bg-primary-50 text-primary-600 rounded">
                  {row.progress.score_percentage}%
                </span>
              )}
            </div>
          </div>
        )}
      />
    </div>
  );
}
