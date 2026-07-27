import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, Toast, useToast, PageHeader, Button, QuizThumbnail } from "@shared";
import type { AssignedQuizSet, ColumnDef, PaginatedResponse, TableQueryParams } from "@shared";
import api from "../../api/client";
import { resolveThumbnailUrl } from "../../utils/media";
import LearningZoneQuizList from "./LearningZoneQuizList";

type Tab = "general" | "learning_zone";

export default function QuizSetDashboard() {
  const navigate = useNavigate();
  const { toast, dismiss } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("general");

  const fetchQuizSets = useCallback(async (params: TableQueryParams): Promise<PaginatedResponse<AssignedQuizSet>> => {
    const res = await api.get("/students/quiz-sets");
    const items: AssignedQuizSet[] = res.data.items || res.data;
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
    {
      key: "thumbnail_url",
      label: "",
      sortable: false,
      width: "72px",
      render: (_val, row) => (
        <QuizThumbnail src={resolveThumbnailUrl(row.thumbnail_url)} alt={row.name} className="w-14 h-10 rounded" />
      ),
    },
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
          <Button
            size="sm"
            className="!bg-white !text-primary-700 hover:!bg-blue-50"
            onClick={() => navigate("/quiz-sets/live")}
          >
            Join Live Quiz
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
            activeTab === "general"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab("learning_zone")}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
            activeTab === "learning_zone"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          Learning Zone
        </button>
      </div>

      {activeTab === "general" && (
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
              <QuizThumbnail src={resolveThumbnailUrl(row.thumbnail_url)} alt={row.name} className="mb-3 h-32 rounded" />
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
      )}

      {activeTab === "learning_zone" && <LearningZoneQuizList />}
    </div>
  );
}
