import { useState, useEffect, useCallback, useRef } from "react";
import { LoadingSpinner, EmptyState, ProgressBar, MathText, Button } from "@shared";
import type { Question, QuizProgress, ReviewQuestion } from "@shared";
import api from "../../api/client";
import QuestionCard from "./QuestionCard";

interface QuizPanelProps {
  quizSource: "book" | "quiz_set";
  quizId: string;
  displayTitle?: string;
}

type QuizState = "loading" | "start" | "active" | "completed";

export default function QuizPanel({ quizSource, quizId, displayTitle }: QuizPanelProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalTimeSeconds, setTotalTimeSeconds] = useState(0);
  const [progress, setProgress] = useState<QuizProgress | null>(null);
  const [quizState, setQuizState] = useState<QuizState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // answers: { question_id -> selected_option }
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // skipped: { question_id -> true }
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [review, setReview] = useState<ReviewQuestion[] | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCompletedRef = useRef(false);

  // Helper function to generate API paths
  const getApiPath = useCallback((endpoint: string) => {
    const basePath = quizSource === "book" ? `/books/${quizId}` : `/quiz-sets/${quizId}`;
    return `${basePath}${endpoint}`;
  }, [quizSource, quizId]);

  const fetchSession = useCallback(async () => {
    try {
      const basePath = quizSource === "book" ? `/books/${quizId}/quiz` : `/quiz-sets/${quizId}/quiz`;
      const res = await api.get(basePath);
      const session = res.data;
      setQuestions(session.questions);
      setTotalQuestions(session.total_questions);
      setTotalTimeSeconds(session.total_time_seconds);
      setProgress(session.progress);
      setAnswers(session.answers || {});
      setSkipped(session.skipped || {});
      setReview(session.review || null);

      if (session.total_questions === 0) {
        setQuizState("loading");
      } else if (session.progress?.is_completed) {
        setQuizState("completed");
      } else if (session.progress?.started_at) {
        // Resume: calculate remaining time
        const elapsed = Math.floor(
          (Date.now() - new Date(session.progress.started_at).getTime()) / 1000
        );
        const remaining = Math.max(0, session.progress.total_time_seconds - elapsed);
        if (remaining <= 0) {
          await api.post(getApiPath(`/quiz/complete`));
          const freshRes = await api.get(getApiPath(`/quiz`));
          setProgress(freshRes.data.progress);
          setQuizState("completed");
        } else {
          setTimeLeft(remaining);
          setQuizState("active");
        }
      } else {
        setQuizState("start");
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 403 ? "This book is not assigned to you." : "Failed to load quiz.");
    }
  }, [quizId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Global timer
  useEffect(() => {
    if (quizState !== "active") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (!autoCompletedRef.current) {
            autoCompletedRef.current = true;
            handleComplete();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [quizState]);

  // Auto-complete on page unload
  useEffect(() => {
    if (quizState !== "active") return;
    const handleUnload = () => {
      const beaconPath = quizSource === "book"
        ? `/api/books/${quizId}/quiz/complete`
        : `/api/quiz-sets/${quizId}/quiz/complete`;
      navigator.sendBeacon(
        beaconPath,
        new Blob([JSON.stringify({})], { type: "application/json" })
      );
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [quizState, quizId]);

  const handleComplete = async () => {
    try {
      const res = await api.post(getApiPath(`/quiz/complete`));
      setProgress(res.data);
      // Fetch review data
      const sessionRes = await api.get(getApiPath(`/quiz`));
      setReview(sessionRes.data.review || null);
    } catch {}
    setQuizState("completed");
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleStartQuiz = async () => {
    try {
      const res = await api.post(getApiPath(`/quiz/start`));
      setProgress(res.data);
      setTimeLeft(res.data.total_time_seconds);
      setCurrentIndex(0);
      setAnswers({});
      setSkipped({});
      setQuizState("active");
    } catch {
      setError("Failed to start quiz.");
    }
  };

  const handleSubmitAnswer = useCallback(
    async (questionId: string, selectedOption: string | null, isSkipped: boolean) => {
      if (submitting) return;
      setSubmitting(true);

      // Optimistic update: if submitting an answer, clear skip state
      if (selectedOption) {
        setAnswers((prev) => ({ ...prev, [questionId]: selectedOption }));
        setSkipped((prev) => ({ ...prev, [questionId]: false }));
      }

      try {
        const res = await api.post(getApiPath(`/quiz/submit`), {
          question_id: questionId,
          selected_option: selectedOption,
          is_skipped: isSkipped,
        });
        setProgress(res.data.progress);
      } catch (err) {
        // Best-effort: revert optimistic update on error
        if (selectedOption) {
          setAnswers((prev) => {
            const newAnswers = { ...prev };
            delete newAnswers[questionId];
            return newAnswers;
          });
        }
      } finally {
        setSubmitting(false);
      }
    },
    [quizId, submitting]
  );

  const handleSkipQuestion = useCallback(
    async (questionId: string) => {
      if (submitting) return;
      setSubmitting(true);

      // Optimistic update
      setSkipped((prev) => ({ ...prev, [questionId]: true }));
      setAnswers((prev) => {
        const newAnswers = { ...prev };
        delete newAnswers[questionId];
        return newAnswers;
      });

      try {
        const res = await api.post(getApiPath(`/quiz/submit`), {
          question_id: questionId,
          selected_option: null,
          is_skipped: true,
        });
        setProgress(res.data.progress);
      } catch {
        // Best-effort
      } finally {
        setSubmitting(false);
      }
    },
    [quizId, submitting]
  );

  const handleFinishQuiz = async () => {
    await handleComplete();
  };

  // --- RENDER ---

  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Error"
        description={error}
        action={{ label: "Try Again", onClick: () => { setError(null); fetchSession(); } }}
      />
    );
  }

  if (quizState === "loading") {
    if (totalQuestions === 0 && !error) {
      return (
        <EmptyState
          icon={
            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="No quiz questions yet"
          description="Quiz questions will be available once your tutor adds them."
        />
      );
    }
    return <LoadingSpinner />;
  }

  // --- START SCREEN ---
  if (quizState === "start") {
    const minutes = Math.floor(totalTimeSeconds / 60);
    const seconds = totalTimeSeconds % 60;

    return (
      <div className="max-w-md mx-auto mt-8">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
          <div className="text-5xl mb-4">📝</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Quiz</h2>
          <p className="text-gray-600 mb-6">
            {totalQuestions} question{totalQuestions !== 1 ? "s" : ""}
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-amber-800 mb-2">Rules</h3>
            <ul className="text-sm text-amber-700 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#8226;</span>
                <span>
                  Total time:{" "}
                  <strong>
                    {minutes > 0 ? `${minutes}m ` : ""}{seconds > 0 ? `${seconds}s` : ""}
                  </strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#8226;</span>
                <span>You can navigate between questions and <strong>change your answers</strong> anytime</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#8226;</span>
                <span>If you leave or time runs out, the quiz will be <strong>auto-submitted</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">&#8226;</span>
                <span>You get <strong>only one attempt</strong> — no retakes</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={handleStartQuiz}
            size="lg"
            fullWidth
            className="py-3 text-lg"
          >
            Start Quiz
          </Button>
        </div>
      </div>
    );
  }

  // --- COMPLETED / RESULTS ---
  if (quizState === "completed" && progress) {
    const passed = progress.score_percentage >= 50;
    return (
      <div className="max-w-2xl mx-auto mt-8">
        {/* Score Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm mb-6">
          <div className="text-5xl mb-4">{passed ? "🎉" : "😔"}</div>
          <h2 className={`text-xl font-bold mb-1 ${passed ? "text-green-600" : "text-red-500"}`}>
            Quiz Completed{passed ? "!" : ""}
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {passed ? "Great work!" : "Better luck next time."}
          </p>
          <div className="bg-gray-50 rounded-lg p-6 mb-4">
            <div className="text-4xl font-bold text-gray-800 mb-1">
              {progress.score_percentage}%
            </div>
            <p className="text-sm text-gray-500">
              {progress.correct_count} of {totalQuestions} correct
            </p>
            <div className="mt-3">
              <ProgressBar percentage={progress.score_percentage} size="sm" showLabel={false} />
            </div>
          </div>
          <p className="text-xs text-gray-400">This quiz cannot be re-attempted.</p>
        </div>

        {/* Question Review */}
        {review && review.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Review Answers</h3>
            <div className="space-y-4">
              {review.map((q, idx) => {
                const options = [
                  { key: "A", text: q.option_a },
                  { key: "B", text: q.option_b },
                  { key: "C", text: q.option_c },
                  { key: "D", text: q.option_d },
                ];

                return (
                  <div
                    key={q.id}
                    className={`bg-white rounded-lg border-2 p-5 ${
                      q.is_correct ? "border-green-200" : q.selected_option ? "border-red-200" : "border-gray-200"
                    }`}
                  >
                    {/* Status badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-500">
                        Question {idx + 1}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          q.is_correct
                            ? "bg-green-100 text-green-700"
                            : q.selected_option
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {q.is_correct ? "Correct" : q.selected_option ? "Incorrect" : "Not answered"}
                      </span>
                    </div>

                    {/* Question text */}
                    <p className="text-gray-800 mb-3 leading-relaxed">
                      <MathText text={q.question_text} />
                    </p>

                    {/* Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {options.map(({ key, text }) => {
                        const isCorrect = key === q.correct_option;
                        const isSelected = key === q.selected_option;
                        const isWrong = isSelected && !isCorrect;

                        let optClass = "border-gray-200 bg-gray-50 text-gray-600";
                        if (isCorrect) {
                          optClass = "border-green-400 bg-green-50 text-green-800";
                        } else if (isWrong) {
                          optClass = "border-red-400 bg-red-50 text-red-800 line-through";
                        }

                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${optClass}`}
                          >
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                isCorrect
                                  ? "bg-green-500 text-white"
                                  : isWrong
                                  ? "bg-red-500 text-white"
                                  : "bg-gray-200 text-gray-500"
                              }`}
                            >
                              {isCorrect ? "✓" : isWrong ? "✗" : key}
                            </span>
                            <MathText text={text} />
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">Explanation: </span>
                          <MathText text={q.explanation} />
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- ACTIVE QUIZ ---
  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const answeredCount = Object.keys(answers).length;
  const skippedCount = Object.keys(skipped).length;
  const totalHandled = answeredCount + skippedCount;
  const timerMinutes = Math.floor(timeLeft / 60);
  const timerSeconds = timeLeft % 60;
  const timerColor =
    timeLeft > 60 ? "text-green-600" : timeLeft > 30 ? "text-yellow-600" : "text-red-600";

  return (
    <div>
      {/* Top bar: timer + answered count */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className={`flex items-center gap-1.5 ${timerColor} font-mono`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-lg font-bold">
              {String(timerMinutes).padStart(2, "0")}:{String(timerSeconds).padStart(2, "0")}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {totalHandled} / {totalQuestions} done
            {answeredCount > 0 && ` (${answeredCount} answered, ${skippedCount} skipped)`}
          </span>
        </div>

        {/* Question Navigator — numbered circles */}
        <div className="flex flex-wrap gap-2">
          {questions.map((q, idx) => {
            const isAnswered = !!answers[q.id];
            const isQuestionSkipped = !!skipped[q.id];
            const isCurrent = idx === currentIndex;

            let circleClass = "border-gray-300 text-gray-500 bg-white hover:bg-gray-50";
            if (isCurrent) {
              circleClass = "border-primary-500 bg-primary-600 text-white";
            } else if (isAnswered) {
              circleClass = "border-green-400 bg-green-500 text-white";
            } else if (isQuestionSkipped) {
              circleClass = "border-yellow-400 bg-yellow-500 text-white";
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${circleClass}`}
                title={isQuestionSkipped ? "Skipped" : isAnswered ? "Answered" : "Not answered"}
              >
                {isQuestionSkipped ? "⏭" : idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Question */}
      <QuestionCard
        key={currentQuestion.id}
        question={currentQuestion}
        questionNumber={currentIndex + 1}
        totalQuestions={totalQuestions}
        selectedAnswer={answers[currentQuestion.id] || null}
        isSkipped={!!skipped[currentQuestion.id]}
        onSubmit={handleSubmitAnswer}
        onSkip={handleSkipQuestion}
        onNext={() => setCurrentIndex((i) => Math.min(i + 1, totalQuestions - 1))}
        onPrevious={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
        canGoNext={currentIndex < totalQuestions - 1}
        canGoPrevious={currentIndex > 0}
        disabled={submitting}
      />

      {/* Finish button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleFinishQuiz}
          className="px-6 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
        >
          Finish Quiz ({totalHandled}/{totalQuestions} done)
        </button>
      </div>
    </div>
  );
}
