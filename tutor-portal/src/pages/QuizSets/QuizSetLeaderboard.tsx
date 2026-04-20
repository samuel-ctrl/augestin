import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LoadingSpinner,
  EmptyState,
  PageHeader,
  Toast,
  useToast,
  extractErrorMessage,
} from "@shared";
import type { QuizSetLeaderboardEntry } from "@shared";
import api from "../../api/client";

interface QuizSetInfo {
  id: string;
  name: string;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export default function QuizSetLeaderboard() {
  const { id: quizSetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quizSet, setQuizSet] = useState<QuizSetInfo | null>(null);
  const [entries, setEntries] = useState<QuizSetLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast, showApiError, dismiss } = useToast();

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [qsRes, lbRes] = await Promise.all([
        api.get<QuizSetInfo>(`/quiz-sets/${quizSetId}`),
        api.get<QuizSetLeaderboardEntry[]>(`/quiz-sets/${quizSetId}/leaderboard`),
      ]);
      setQuizSet(qsRes.data);
      setEntries(lbRes.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        navigate("/quiz-sets");
        return;
      }
      setError(extractErrorMessage(err, "Failed to load leaderboard. Please try again."));
      showApiError(err, "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  }, [quizSetId, navigate, showApiError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => fetchData() }}
      />
    );
  }
  if (!quizSet) return null;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title={`Leaderboard — ${quizSet.name}`}
        backButton={{ label: "Quizzes", onClick: () => navigate("/quiz-sets") }}
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={<span>🏆</span>}
          title="No completions yet"
          description="No one has completed this quiz yet. The leaderboard will populate as students finish."
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-16">
                    Rank
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">
                    Score
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-24">
                    Time
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">
                    Completed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map((e) => (
                  <tr key={e.student_id}>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900">{e.rank}</td>
                    <td className="px-4 py-2 text-sm text-gray-800">
                      {e.student_name}
                      <span className="ml-2 text-xs text-gray-500">{e.student_login_id}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {e.correct_count}/{e.total_questions} — {e.score_percentage.toFixed(0)}%
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{formatTime(e.total_time_seconds)}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {new Date(e.completed_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
