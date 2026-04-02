import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LoadingSpinner,
  EmptyState,
  ConfirmDialog,
  Toast,
  useToast,
  MathText,
  extractErrorMessage,
  Button,
} from "@shared";
import type { Question } from "@shared";
import api from "../../api/client";

interface QuizSetInfo {
  id: string;
  name: string;
}

export default function QuizSetQuestions() {
  const { id: quizSetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quizSet, setQuizSet] = useState<QuizSetInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [quizSetRes, questionsRes] = await Promise.all([
        api.get(`/quiz-sets/${quizSetId}`),
        api.get(`/quiz-sets/${quizSetId}/questions`, {
          params: { page: 1, page_size: 100, sort_by: "created_at", sort_order: "asc" },
        }),
      ]);
      setQuizSet(quizSetRes.data);
      setQuestions(questionsRes.data.items);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        navigate("/quiz-sets");
      } else {
        setError(extractErrorMessage(err, "Failed to load questions."));
      }
    } finally {
      setLoading(false);
    }
  }, [quizSetId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/questions/${deleteTarget.id}`);
      showSuccess("Question deleted successfully.");
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      setDeleteTarget(null);
      showApiError(err, "Failed to delete question.");
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => { setLoading(true); fetchData(); } }}
      />
    );
  }
  if (!quizSet) return null;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate("/quiz-sets")}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-flex items-center gap-1"
          >
            &larr; Back to Quiz Sets
          </button>
          <h1 className="text-xl font-semibold text-gray-800">
            {quizSet.name} — Questions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {questions.length} question{questions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button color="secondary" onClick={() => navigate(`/quiz-sets/${quizSetId}/edit`)}>
            ✏️ Edit Quiz Set
          </Button>
          <Button color="secondary" onClick={() => navigate(`/quiz-sets/${quizSetId}/assign`)}>
            👥 Manage Assignments
          </Button>
          <Button color="success" onClick={() => navigate(`/quiz-sets/${quizSetId}/questions/new`)}>
            + Add Question
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <EmptyState
          icon={<span>?</span>}
          title="No questions yet"
          description="Add quiz questions for this quiz set."
          action={{
            label: "Add Question",
            onClick: () => navigate(`/quiz-sets/${quizSetId}/questions/new`),
          }}
        />
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs text-gray-400 font-medium w-6 shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="text-sm text-gray-800 truncate">
                    <MathText text={q.question_text} />
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded font-medium">
                    {q.correct_option}
                  </span>
                  <span className="text-xs text-gray-400">{q.time_limit_seconds}s</span>
                  <Button
                    variant="ghost" color="primary" size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/questions/${q.id}/edit`);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost" color="danger" size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(q);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {expandedId === q.id && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {(["A", "B", "C", "D"] as const).map((opt) => {
                      const key = `option_${opt.toLowerCase()}` as keyof Question;
                      const isCorrect = q.correct_option === opt;
                      return (
                        <div
                          key={opt}
                          className={`p-2 rounded text-sm border ${
                            isCorrect
                              ? "border-green-300 bg-green-50"
                              : "border-gray-200 bg-gray-50"
                          }`}
                        >
                          <span className="font-medium text-gray-500 mr-1">{opt}.</span>
                          <MathText text={String(q[key] ?? "")} />
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && (
                    <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-800">
                      <span className="font-medium">Explanation: </span>
                      <MathText text={q.explanation} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Question"
        alertMessage="This action cannot be undone."
        message="Are you sure you want to delete this question?"
        confirmLabel="Delete"
        variant="danger"
        countdownSeconds={5}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
