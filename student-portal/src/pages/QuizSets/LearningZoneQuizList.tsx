import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState, LoadingSpinner, Toast, useToast } from "@shared";
import type { LearningZoneQuiz, LiveQuizRoomSnapshot } from "@shared";
import api from "../../api/client";

const DEFAULT_THUMBNAIL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200' fill='%23e5e7eb'%3E%3Crect width='300' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='40'%3E%F0%9F%93%9A%3C/text%3E%3C/svg%3E";

export default function LearningZoneQuizList() {
  const navigate = useNavigate();
  const { toast, showApiError, dismiss } = useToast();
  const [quizzes, setQuizzes] = useState<LearningZoneQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingRoomFor, setCreatingRoomFor] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ items: LearningZoneQuiz[] }>("/students/books/quizzes")
      .then((res) => setQuizzes(res.data.items))
      .catch((err) => showApiError(err, "Failed to load learning zone quizzes."))
      .finally(() => setLoading(false));
  }, [showApiError]);

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

  if (loading) return <LoadingSpinner />;

  if (quizzes.length === 0) {
    return (
      <EmptyState
        icon={<span className="text-3xl">📚</span>}
        title="No learning zone quizzes"
        description="Quizzes from books assigned to you will appear here once the books have questions."
      />
    );
  }

  // Group by subject
  const bySubject = quizzes.reduce<Record<string, LearningZoneQuiz[]>>((acc, q) => {
    const key = q.subject_name || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {Object.entries(bySubject).map(([subject, items]) => (
        <div key={subject} className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            {subject}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((quiz) => (
              <LearningZoneCard
                key={quiz.book_id}
                quiz={quiz}
                isCreating={creatingRoomFor === quiz.book_id}
                onPlay={() => handlePlayMultiplayer(quiz)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LearningZoneCard({
  quiz,
  isCreating,
  onPlay,
}: {
  quiz: LearningZoneQuiz;
  isCreating: boolean;
  onPlay: () => void;
}) {
  const locked = !quiz.is_quiz_unlocked;

  return (
    <div className={`rounded-lg border p-4 transition-all ${
      locked
        ? "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-70"
        : "bg-[rgb(191_189_207_/_38%)] border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-primary-300"
    }`}>
      <div className="mb-3 h-32 bg-gray-200 dark:bg-gray-600 rounded overflow-hidden relative">
        <img
          src={quiz.book_thumbnail_url || DEFAULT_THUMBNAIL}
          alt={quiz.book_title}
          className={`w-full h-full object-cover ${locked ? "grayscale" : ""}`}
          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_THUMBNAIL; }}
        />
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        )}
      </div>

      <h3 className={`font-semibold text-sm line-clamp-2 ${
        locked ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-gray-50"
      }`}>
        {quiz.book_title}
      </h3>

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {quiz.question_count} Q{quiz.question_count !== 1 ? "s" : ""}
        </span>
        {locked ? (
          <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Watch video to unlock
          </span>
        ) : (
          <button
            onClick={onPlay}
            disabled={isCreating}
            className="px-3 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isCreating ? "Creating..." : "Play Multiplayer"}
          </button>
        )}
      </div>
    </div>
  );
}
