import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, Toast, useToast, BookThumbnail } from "@shared";
import type {
  LearningZoneQuiz,
  LiveQuizRoomSnapshot,
  ColumnDef,
  PaginatedResponse,
  TableQueryParams,
} from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";
import { toDirectImageUrl, isGoogleDriveUrl } from "@shared";

function resolveThumbnailUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return isGoogleDriveUrl(url) ? toDirectImageUrl(url) : assetUrl(url);
}

export default function LearningZoneQuizList() {
  const navigate = useNavigate();
  const { toast, showApiError, dismiss } = useToast();
  const [creatingRoomFor, setCreatingRoomFor] = useState<string | null>(null);

  const handlePlayMultiplayer = async (quiz: LearningZoneQuiz) => {
    setCreatingRoomFor(quiz.book_id);
    try {
      const res = await api.post<LiveQuizRoomSnapshot>("/quiz-rooms", { book_id: quiz.book_id });
      navigate(`/quiz-sets/${quiz.book_id}/live/${res.data.code}`);
    } catch (err) {
      showApiError(err, "Failed to create room. Please try again.");
    } finally {
      setCreatingRoomFor(null);
    }
  };

  const fetchQuizzes = useCallback(async (params: TableQueryParams): Promise<PaginatedResponse<LearningZoneQuiz>> => {
    const res = await api.get<{ items: LearningZoneQuiz[] }>("/students/books/quizzes");
    let items: LearningZoneQuiz[] = res.data.items || [];

    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (item) =>
          item.book_title.toLowerCase().includes(q) ||
          item.subject_name.toLowerCase().includes(q),
      );
    }

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

  const columns: ColumnDef<LearningZoneQuiz>[] = [
    {
      key: "book_thumbnail_url",
      label: "",
      sortable: false,
      width: "72px",
      render: (_val, row) => (
        <BookThumbnail
          src={resolveThumbnailUrl(row.book_thumbnail_url)}
          alt={row.book_title}
          className={`w-14 h-10 rounded ${!row.is_quiz_unlocked ? "grayscale" : ""}`}
        />
      ),
    },
    { key: "book_title", label: "Title", sortable: false },
    { key: "subject_name", label: "Subject", sortable: false, width: "150px" },
    {
      key: "question_count",
      label: "Questions",
      sortable: false,
      width: "110px",
      render: (val) => `${val} Q${val !== 1 ? "s" : ""}`,
    },
    {
      key: "is_quiz_unlocked",
      label: "Status",
      sortable: false,
      width: "190px",
      render: (_val, row) =>
        row.is_quiz_unlocked ? (
          <button
            onClick={(e) => { e.stopPropagation(); handlePlayMultiplayer(row); }}
            disabled={creatingRoomFor === row.book_id}
            className="px-3 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {creatingRoomFor === row.book_id ? "Creating..." : "Play Multiplayer"}
          </button>
        ) : (
          <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Watch video to unlock
          </span>
        ),
    },
  ];

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <DataTable<LearningZoneQuiz>
        fetchFn={fetchQuizzes}
        columns={columns}
        searchPlaceholder="Search learning zone quizzes..."
        rowKey={(q) => q.book_id}
        renderCard={(row) => (
          <div className={`rounded-lg border p-4 transition-all ${
            row.is_quiz_unlocked
              ? "bg-[rgb(191_189_207_/_38%)] border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-primary-300"
              : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-70"
          }`}>
            <div className="relative mb-3">
              <BookThumbnail
                src={resolveThumbnailUrl(row.book_thumbnail_url)}
                alt={row.book_title}
                className={`h-32 rounded ${!row.is_quiz_unlocked ? "grayscale" : ""}`}
              />
              {!row.is_quiz_unlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              )}
            </div>
            <h3 className={`font-semibold text-sm line-clamp-2 ${
              row.is_quiz_unlocked ? "text-gray-900 dark:text-gray-50" : "text-gray-500 dark:text-gray-400"
            }`}>
              {row.book_title}
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{row.subject_name}</p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {row.question_count} Q{row.question_count !== 1 ? "s" : ""}
              </span>
              {row.is_quiz_unlocked ? (
                <button
                  onClick={() => handlePlayMultiplayer(row)}
                  disabled={creatingRoomFor === row.book_id}
                  className="px-3 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {creatingRoomFor === row.book_id ? "Creating..." : "Play Multiplayer"}
                </button>
              ) : (
                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Watch video to unlock
                </span>
              )}
            </div>
          </div>
        )}
      />
    </div>
  );
}
