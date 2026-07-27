import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { LoadingSpinner, EmptyState, Toast, useToast, PageHeader, BookCard, QuizThumbnail } from "@shared";
import type { AssignedQuizSet } from "@shared";
import api from "../../api/client";
import { resolveThumbnailUrl } from "../../utils/media";
import { getRandomWelcomeQuote } from "./welcomeQuotes";

interface PendingBook {
  id: string;
  title: string;
  topic_count: number;
  thumbnail_url?: string;
  standard: string;
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

  const [pendingBooks, setPendingBooks] = useState<PendingBook[]>([]);
  const [readyQuizSets, setReadyQuizSets] = useState<AssignedQuizSet[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [loading, setLoading] = useState(true);
  // Pick a random encouragement subtitle once per visit (stable across re-renders).
  const [welcomeSubtitle] = useState(getRandomWelcomeQuote);

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

        const pending: PendingBook[] = [];
        const allTasks: TaskItem[] = [];

        books.forEach((book: any) => {
          pending.push({
            id: book.id,
            title: book.title,
            topic_count: book.topic_count || 0,
            thumbnail_url: book.thumbnail_url,
            standard: book.standard || "",
          });

          allTasks.push({
            id: book.id,
            name: book.title,
            subject: book.subject_name || "Book",
            date: book.assigned_at || book.created_at || "",
            type: "book",
            status: "todo",
            progress: 0,
          });
        });

        const ready: AssignedQuizSet[] = [];
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
            ready.push(qs);
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

        setReadyQuizSets(ready);
        setPendingBooks(pending);
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

  const hasContent = pendingBooks.length > 0 || readyQuizSets.length > 0;

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
        subtitle={welcomeSubtitle}
      />

      {/* My Tasks Widget */}
      {tasks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-3">My Tasks</h2>

          {/* Filter Tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTaskFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  taskFilter === tab.key
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Task List */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
            {filteredTasks.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
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
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
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
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
                      {task.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{task.subject}</span>
                      {task.date && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(task.date).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-20 shrink-0">
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          task.status === "done"
                            ? "bg-green-500"
                            : "bg-primary-500"
                        }`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-0.5">
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
          icon={<ClipboardList className="w-6 h-6" />}
          title="No assignments yet"
          description="Check back later for books and quizzes assigned by your tutor."
          action={{ label: "Go to Learn Zone", onClick: () => navigate("/self-study") }}
        />
      ) : (
        <div className="space-y-8">
          {/* Ready Quiz Sets */}
          {readyQuizSets.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-4">Quiz Sets Ready</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {readyQuizSets.map((qs) => (
                  <button
                    key={qs.id}
                    onClick={() => navigate(`/quiz-sets/${qs.id}`)}
                    className="bg-[rgb(191_189_207_/_38%)] dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow text-left"
                  >
                    <QuizThumbnail src={resolveThumbnailUrl(qs.thumbnail_url)} alt={qs.name} className="mb-3 h-24 rounded" />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-50 text-sm line-clamp-2">
                      {qs.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {qs.question_count} question{qs.question_count !== 1 ? "s" : ""}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* My Books */}
          {pendingBooks.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-4">My Books</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pendingBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    title={book.title}
                    standard={book.standard}
                    thumbnailUrl={resolveThumbnailUrl(book.thumbnail_url)}
                    topicCount={book.topic_count}
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
