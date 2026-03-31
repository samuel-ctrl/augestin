import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner, EmptyState, Toast, useToast, extractErrorMessage, PageHeader } from "@shared";
import type { Book, AssignedQuizSet, QuizProgress } from "@shared";
import api from "../../api/client";

interface AssignedBook {
  id: string;
  title: string;
  subject_id: string;
  thumbnail_url?: string;
}

interface PendingQuiz {
  id: string;
  title: string;
  question_count: number;
  thumbnail_url?: string;
}

interface ContinueWatching {
  id: string;
  title: string;
  progress: QuizProgress;
  thumbnail_url?: string;
}

export default function HomeDashboard() {
  const navigate = useNavigate();
  const { toast, showApiError, dismiss } = useToast();

  const [pendingQuizzes, setPendingQuizzes] = useState<PendingQuiz[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatching[]>([]);
  const [readyQuizSets, setReadyQuizSets] = useState<AssignedQuizSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch assigned books with their progress
        const booksRes = await api.get<{ items: any[] }>("/students/books");
        const quizSetsRes = await api.get<AssignedQuizSet[]>("/students/quiz-sets");

        const books = booksRes.data.items || [];
        const quizSets = Array.isArray(quizSetsRes.data) ? quizSetsRes.data : [];

        // Separate books into pending and continue watching
        const pending: PendingQuiz[] = [];
        const continuing: ContinueWatching[] = [];

        books.forEach((book) => {
          // Check if book has quiz progress
          if (book.progress && book.progress.is_started) {
            // Continue watching: has started but not completed
            if (!book.progress.is_completed) {
              continuing.push({
                id: book.id,
                title: book.title,
                progress: book.progress,
                thumbnail_url: book.thumbnail_url,
              });
            }
          } else {
            // Pending: no progress started
            pending.push({
              id: book.id,
              title: book.title,
              question_count: book.question_count || 0,
              thumbnail_url: book.thumbnail_url,
            });
          }
        });

        // Filter quiz sets: ready = assigned but not completed
        const ready = quizSets.filter(
          (qs) => !qs.progress || (qs.progress && !qs.progress.is_completed)
        );

        setPendingQuizzes(pending);
        setContinueWatching(continuing);
        setReadyQuizSets(ready);
      } catch (err: unknown) {
        showApiError(err, "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [showApiError]);

  if (loading) return <LoadingSpinner fullPage />;

  const hasContent =
    pendingQuizzes.length > 0 ||
    continueWatching.length > 0 ||
    readyQuizSets.length > 0;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      <PageHeader
        title="Welcome Back"
        subtitle="Continue learning or start something new"
      />

      {!hasContent ? (
        <EmptyState
          icon={<span>🎓</span>}
          title="No assignments yet"
          description="Check back later for books and quizzes assigned by your tutor."
          action={{ label: "Go to Self-Study", onClick: () => navigate("/self-study") }}
        />
      ) : (
        <div className="space-y-8">
          {/* Continue Watching */}
          {continueWatching.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Continue Reading</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {continueWatching.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => navigate(`/self-study/books/${book.id}`)}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-shadow text-left"
                  >
                    {book.thumbnail_url && (
                      <div className="mb-3 h-24 bg-gray-200 rounded overflow-hidden">
                        <img
                          src={book.thumbnail_url}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2">
                      {book.title}
                    </h3>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${book.progress.score_percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {book.progress.score_percentage}% complete
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Ready Quiz Sets */}
          {readyQuizSets.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quiz Sets Ready</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {readyQuizSets.map((qs) => (
                  <button
                    key={qs.id}
                    onClick={() => navigate(`/quiz-sets/${qs.id}`)}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-shadow text-left"
                  >
                    {qs.thumbnail_url && (
                      <div className="mb-3 h-24 bg-gray-200 rounded overflow-hidden">
                        <img
                          src={qs.thumbnail_url}
                          alt={qs.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                      {qs.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-2">
                      {qs.question_count} question{qs.question_count !== 1 ? "s" : ""}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Pending Quizzes */}
          {pendingQuizzes.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Books</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {pendingQuizzes.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => navigate(`/self-study/books/${book.id}`)}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-shadow text-left"
                  >
                    {book.thumbnail_url && (
                      <div className="mb-3 h-24 bg-gray-200 rounded overflow-hidden">
                        <img
                          src={book.thumbnail_url}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                      {book.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-2">
                      {book.question_count} question{book.question_count !== 1 ? "s" : ""}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
