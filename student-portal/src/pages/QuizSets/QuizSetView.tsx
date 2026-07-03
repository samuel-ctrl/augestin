import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { LoadingSpinner, EmptyState, PageHeader, Button, Toast, useToast, extractErrorMessage } from "@shared";
import type { QuizSet, QuizSetLeaderboardEntry, LiveQuizRoomSnapshot } from "@shared";
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
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hosting, setHosting] = useState(false);
  const { toast, showApiError, dismiss } = useToast();

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await api.get<QuizSetLeaderboardEntry[]>(
        `/students/quiz-sets/${quizSetId}/leaderboard`
      );
      setLeaderboard(res.data);
    } catch {
      setLeaderboard([]);
    }
  }, [quizSetId]);

  // The leaderboard is only meaningful — and only shown — to a student who has
  // completed this quiz. Fetch it only once they finish.
  const handleQuizCompletedChange = useCallback(
    (completed: boolean) => {
      setQuizCompleted(completed);
      if (completed) fetchLeaderboard();
    },
    [fetchLeaderboard]
  );

  const handleHostLive = async () => {
    setHosting(true);
    try {
      const res = await api.post<LiveQuizRoomSnapshot>("/quiz-rooms", {
        quiz_set_id: quizSetId,
      });
      navigate(`/quiz-sets/${quizSetId}/live/${res.data.code}`);
    } catch (err) {
      showApiError(err, "Failed to start live room.");
    } finally {
      setHosting(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qsRes = await api.get(`/quiz-sets/${quizSetId}`);
        setQuizSet(qsRes.data);
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
        icon={<AlertTriangle className="w-6 h-6" />}
        variant="error"
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => window.location.reload() }}
      />
    );
  }
  if (!quizSet) return null;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title={quizSet.name}
        subtitle={quizSet.description}
        backButton={{ label: "Quizzes", onClick: () => navigate("/quiz-sets") }}
        actions={
          <Button
            color="success"
            size="sm"
            className="!bg-white !text-emerald-700 hover:!bg-emerald-50"
            onClick={handleHostLive}
            loading={hosting}
          >
            🎮 Play Live with Friends
          </Button>
        }
      />

      <QuizPanel
        quizSource="quiz_set"
        quizId={quizSetId!}
        onCompletedChange={handleQuizCompletedChange}
      />

      {quizCompleted && leaderboard.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">🏆 Leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-16">Rank</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">Student</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-40">Score</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-24">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {leaderboard.map((e) => {
                  const isMe = user && e.student_id === user.id;
                  return (
                    <tr key={e.student_id} className={isMe ? "bg-amber-50" : ""}>
                      <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-50">{e.rank}</td>
                      <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-100">
                        {e.student_name}
                        {isMe && <span className="ml-2 text-xs text-amber-600">(you)</span>}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
                        {e.correct_count}/{e.total_questions} — {e.score_percentage.toFixed(0)}%
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">{formatTime(e.total_time_seconds)}</td>
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
