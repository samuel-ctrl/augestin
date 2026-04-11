import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner, EmptyState, Toast, useToast, PageHeader, BookCard } from "@shared";
import type { AssignedQuizSet, QuizProgress } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";

interface PendingQuiz {
  id: string;
  title: string;
  question_count: number;
  thumbnail_url?: string;
  standard: string;
}

interface ContinueWatching {
  id: string;
  title: string;
  progress: QuizProgress;
  thumbnail_url?: string;
}

interface TaskItem {
  id: string;
  name: string;
  subject: string;
  date: string;
  type: "book" | "quiz_set";
  status: "todo" | "in_progress" | "done";
  progress: number;
}

type TaskFilter = "all" | "todo" | "in_progress" | "done";

export default function HomeDashboard() {
  const navigate = useNavigate();
  const { toast, showApiError, dismiss } = useToast();

  const [pendingQuizzes, setPendingQuizzes] = useState<PendingQuiz[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatching[]>([]);
  const [readyQuizSets, setReadyQuizSets] = useState<AssignedQuizSet[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        const [booksRes, quizSetsRes] = await Promise.all([
          api.get<{ items: any[] }>("/students/books"),
          api.get<AssignedQuizSet[]>("/students/quiz-sets"),
        ]);

        const books = booksRes.data.items || [];
        const quizSets = Array.isArray(quizSetsRes.data) ? quizSetsRes.data : [];

        const pending: PendingQuiz[] = [];
        const continuing: ContinueWatching[] = [];
        const allTasks: TaskItem[] = [];

        books.forEach((book: any) => {
          let status: TaskItem["status"] = "todo";
          let progress = 0;

          if (book.progress && book.progress.is_completed) {
            status = "done";
            progress = 100;
          } else if (book.progress && book.progress.is_started) {
            status = "in_progress";
            progress = book.progress.score_percentage || 0;
            continuing.push({
              id: book.id,
              title: book.title,
              progress: book.progress,
              thumbnail_url: book.thumbnail_url,
            });
          } else {
            pending.push({
              id: book.id,
              title: book.title,
              question_count: book.question_count || 0,
              thumbnail_url: book.thumbnail_url,
              standard: book.standard || "",
            });
          }

          allTasks.push({
            id: book.id,
            name: book.title,
            subject: book.subject_name || "Book",
            date: book.assigned_at || book.created_at || "",
            type: "book",
            status,
            progress,
          });
        });

        quizSets.forEach((qs: any) => {
          let status: TaskItem["status"] = "todo";
          let progress = 0;

          if (qs.progress && qs.progress.is_completed) {
            status = "done";
            progress = 100;
          } else if (qs.progress && qs.progress.is_started) {
            status = "in_progress";
            progress = qs.progress.score_percentage || 0;
          }

          if (!qs.progress || !qs.progress.is_completed) {
            setReadyQuizSets((prev) => [...prev, qs]);
          }

          allTasks.push({
            id: qs.id,
            name: qs.name,
            subject: "Quiz Set",
            date: qs.assigned_at || qs.created_at || "",
            type: "quiz_set",
            status,
            progress,
          });
        });

        setPendingQuizzes(pending);
        setContinueWatching(continuing);
        setTasks(allTasks);
      } catch (err: unknown) {
        showApiError(err, "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [showApiError]);

  if (loading) return <LoadingSpinner fullPage />;

  const filteredTasks = tasks.filter(
    (t) => taskFilter === "all" || t.status === taskFilter
  );

  const pendingTaskCount = tasks.filter((t) => t.status !== "done").length;

  const hasContent =
    pendingQuizzes.length > 0 ||
    continueWatching.length > 0 ||
    readyQuizSets.length > 0;

  const filterTabs: { key: TaskFilter; label: string }[] = [
    { key: "all", label: `All Tasks (${tasks.length})` },
    { key: "todo", label: `To Do (${tasks.filter((t) => t.status === "todo").length})` },
    { key: "in_progress", label: `In Progress (${tasks.filter((t) => t.status === "in_progress").length})` },
    { key: "done", label: `Done (${tasks.filter((t) => t.status === "done").length})` },
  ];

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      <PageHeader
        title="Welcome Back"
        subtitle="Continue learning or start something new"
      />

      {/* Pending Tasks Summary */}
      {pendingTaskCount > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 text-lg">⚡</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {pendingTaskCount} Pending Task{pendingTaskCount !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-600">
                You have {tasks.filter((t) => t.status === "todo").length} not started and{" "}
                {tasks.filter((t) => t.status === "in_progress").length} in progress
              </p>
            </div>
          </div>
        </div>
      )}

      {/* My Tasks Widget */}
      {tasks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">My Tasks</h2>

          {/* Filter Tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTaskFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  taskFilter === tab.key
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Task List */}
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {filteredTasks.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                No tasks in this category
              </div>
            ) : (
              filteredTasks.map((task) => (
                <button
                  key={`${task.type}-${task.id}`}
                  onClick={() =>
                    navigate(
                      task.type === "book"
                        ? `/self-study/books/${task.id}`
                        : `/quiz-sets/${task.id}`
                    )
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Status dot */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      task.status === "done"
                        ? "bg-green-500"
                        : task.status === "in_progress"
                        ? "bg-blue-500"
                        : "bg-gray-300"
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {task.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{task.subject}</span>
                      {task.date && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-xs text-gray-400">
                            {new Date(task.date).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-20 shrink-0">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          task.status === "done"
                            ? "bg-green-500"
                            : "bg-primary-500"
                        }`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 text-right mt-0.5">
                      {Math.round(task.progress)}%
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {!hasContent && tasks.length === 0 ? (
        <EmptyState
          icon={<span>🎓</span>}
          title="No assignments yet"
          description="Check back later for books and quizzes assigned by your tutor."
          action={{ label: "Go to Learn Zone", onClick: () => navigate("/self-study") }}
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
                    className="bg-[rgb(191_189_207_/_38%)] rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-shadow text-left"
                  >
                    {book.thumbnail_url && (
                      <div className="mb-3 h-24 bg-gray-200 rounded overflow-hidden">
                        <img
                          src={assetUrl(book.thumbnail_url)}
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
                    className="bg-[rgb(191_189_207_/_38%)] rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-shadow text-left"
                  >
                    {qs.thumbnail_url && (
                      <div className="mb-3 h-24 bg-gray-200 rounded overflow-hidden">
                        <img
                          src={assetUrl(qs.thumbnail_url)}
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
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Next Books</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pendingQuizzes.map((book) => (
                  <BookCard
                    key={book.id}
                    title={book.title}
                    standard={book.standard}
                    thumbnailUrl={assetUrl(book.thumbnail_url)}
                    questionCount={book.question_count}
                    onClick={() => navigate(`/self-study/books/${book.id}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
