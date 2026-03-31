import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner, EmptyState, Toast, useToast, extractErrorMessage, PageHeader } from "@shared";
import type { AssignedQuizSet } from "@shared";
import api from "../../api/client";

export default function QuizSetDashboard() {
  const navigate = useNavigate();
  const [quizSets, setQuizSets] = useState<AssignedQuizSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast, showApiError, dismiss } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/students/quiz-sets");
        setQuizSets(res.data.items || res.data);
      } catch (err: unknown) {
        setError(extractErrorMessage(err, "Failed to load quiz sets."));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => window.location.reload() }}
      />
    );
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title="Quiz Sets"
        subtitle="Available quiz sets assigned to you"
      />

      {quizSets.length === 0 ? (
        <EmptyState
          icon={<span>🧩</span>}
          title="No quiz sets assigned yet"
          description="Check back later for new quiz sets."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizSets.map((qs) => (
            <button
              key={qs.id}
              onClick={() => navigate(`/quiz-sets/${qs.id}`)}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg hover:border-primary-300 transition-all text-left"
            >
              {qs.thumbnail_url && (
                <div className="mb-3 h-32 bg-gray-200 rounded overflow-hidden">
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
              {qs.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{qs.description}</p>}
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500">
                  {qs.question_count} Q{qs.question_count !== 1 ? "s" : ""}
                </span>
                {qs.progress && (
                  <span className="text-xs px-2 py-0.5 bg-primary-50 text-primary-600 rounded">
                    {qs.progress.score_percentage}%
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
