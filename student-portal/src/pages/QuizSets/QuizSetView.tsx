import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { LoadingSpinner, EmptyState, PageHeader, extractErrorMessage } from "@shared";
import type { QuizSet, QuizSetLeaderboardEntry } from "@shared";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import QuizPanel from "../SelfStudy/QuizPanel";

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export default function QuizSetView() {
  const { id: quizSetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quizSet, setQuizSet] = useState<QuizSet | null>(null);
  const [leaderboard, setLeaderboard] = useState<QuizSetLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [qsRes, lbRes] = await Promise.all([
          api.get(`/quiz-sets/${quizSetId}`),
          api.get<QuizSetLeaderboardEntry[]>(`/students/quiz-sets/${quizSetId}/leaderboard`)
            .catch(() => ({ data: [] as QuizSetLeaderboardEntry[] })),
        ]);
        setQuizSet(qsRes.data);
        setLeaderboard(lbRes.data);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          navigate("/quiz-sets");
        } else {
          setError(extractErrorMessage(err, "Failed to load quiz set. Please try again."));
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [quizSetId, navigate]);

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
  if (!quizSet) return null;

  return (
    <div>
      <PageHeader
        title={quizSet.name}
        subtitle={quizSet.description}
        backButton={{ label: "Quiz Sets", onClick: () => navigate("/quiz-sets") }}
      />

      <QuizPanel quizSource="quiz_set" quizId={quizSetId!} />

      {leaderboard.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🏆 Leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-16">Rank</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Student</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">Score</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-24">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaderboard.map((e) => {
                  const isMe = user && e.student_id === user.id;
                  return (
                    <tr key={e.student_id} className={isMe ? "bg-amber-50" : ""}>
                      <td className="px-4 py-2 text-sm font-semibold text-gray-900">{e.rank}</td>
                      <td className="px-4 py-2 text-sm text-gray-800">
                        {e.student_name}
                        {isMe && <span className="ml-2 text-xs text-amber-600">(you)</span>}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {e.correct_count}/{e.total_questions} — {e.score_percentage.toFixed(0)}%
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">{formatTime(e.total_time_seconds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
