import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LoadingSpinner, EmptyState, PageHeader, Button, Toast, useToast,
  LiveLeaderboard, ConfirmDialog,
} from "@shared";
import type {
  LiveQuizRoomSnapshot, Question, LiveQuizLeaderboardEntry,
  LiveQuizParticipant,
} from "@shared";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useWS } from "../../context/WebSocketContext";
import QuestionCard from "../SelfStudy/QuestionCard";

type RoomEventPayload = {
  code?: string;
  started_at?: string;
  total_time_seconds?: number;
  questions?: Question[];
  participant?: LiveQuizParticipant;
  user_id?: string;
  leaderboard?: LiveQuizLeaderboardEntry[];
  final_leaderboard?: LiveQuizLeaderboardEntry[];
  questions_with_answers?: Question[];
  reason?: string;
};

function formatTime(total: number): string {
  if (total < 0) total = 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function LiveQuizRoom() {
  const { code = "" } = useParams<{ id: string; code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { on } = useWS();
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const [snapshot, setSnapshot] = useState<LiveQuizRoomSnapshot | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const snapshotRef = useRef<LiveQuizRoomSnapshot | null>(null);

  const refreshSnapshot = useCallback(async () => {
    try {
      const res = await api.get<LiveQuizRoomSnapshot>(`/quiz-rooms/${code}`);
      setSnapshot(res.data);
      snapshotRef.current = res.data;
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        navigate("/quiz-sets");
      } else {
        showApiError(err, "Could not load room.");
      }
    }
  }, [code, navigate, showApiError]);

  // Initial fetch
  useEffect(() => {
    refreshSnapshot();
  }, [refreshSnapshot]);

  // Tick the clock every second while active
  useEffect(() => {
    if (snapshot?.status !== "active") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [snapshot?.status]);

  // Subscribe to live events
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    const matches = (p: RoomEventPayload) => !p.code || p.code === code;

    unsubs.push(on("quiz-room:started", (ev) => {
      const p = (ev.payload || {}) as RoomEventPayload;
      if (!matches(p)) return;
      setSnapshot((prev) => prev ? {
        ...prev,
        status: "active",
        started_at: p.started_at ?? prev.started_at,
        total_time_seconds: p.total_time_seconds ?? prev.total_time_seconds,
        questions: p.questions ?? prev.questions,
      } : prev);
    }));

    unsubs.push(on("quiz-room:participant-joined", (ev) => {
      const p = (ev.payload || {}) as RoomEventPayload;
      if (!matches(p) || !p.participant) return;
      setSnapshot((prev) => {
        if (!prev) return prev;
        const exists = prev.participants.some((x) => x.user_id === p.participant!.user_id);
        if (exists) return prev;
        return { ...prev, participants: [...prev.participants, p.participant!] };
      });
    }));

    unsubs.push(on("quiz-room:participant-left", (ev) => {
      const p = (ev.payload || {}) as RoomEventPayload;
      if (!matches(p) || !p.user_id) return;
      setSnapshot((prev) => prev ? {
        ...prev,
        participants: prev.participants.map((x) =>
          x.user_id === p.user_id ? { ...x, connected: false } : x,
        ),
      } : prev);
    }));

    unsubs.push(on("quiz-room:leaderboard-updated", (ev) => {
      const p = (ev.payload || {}) as RoomEventPayload;
      if (!matches(p) || !p.leaderboard) return;
      setSnapshot((prev) => prev ? { ...prev, leaderboard: p.leaderboard! } : prev);
    }));

    unsubs.push(on("quiz-room:finished", (ev) => {
      const p = (ev.payload || {}) as RoomEventPayload;
      if (!matches(p)) return;
      setSnapshot((prev) => prev ? {
        ...prev,
        status: "finished",
        leaderboard: p.final_leaderboard ?? prev.leaderboard,
        questions: p.questions_with_answers ?? prev.questions,
      } : prev);
    }));

    unsubs.push(on("quiz-room:closed", (ev) => {
      const p = (ev.payload || {}) as RoomEventPayload;
      if (!matches(p)) return;
      showSuccess("Host ended the room.");
    }));

    return () => { unsubs.forEach((u) => u()); };
  }, [on, code, showSuccess]);

  // When we reconnect via the hook, refresh snapshot to pick up any missed state.
  // useWebSocket reconnects automatically but doesn't replay events, so we re-pull.
  useEffect(() => {
    const onFocus = () => {
      if (snapshotRef.current && snapshotRef.current.status !== "finished") {
        refreshSnapshot();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshSnapshot]);

  const isHost = snapshot && user?.id === snapshot.host_id;
  const isPlayer = snapshot?.you_role === "player";

  const remaining = useMemo(() => {
    if (!snapshot?.started_at) return snapshot?.total_time_seconds ?? 0;
    const startedMs = new Date(snapshot.started_at).getTime();
    const elapsed = Math.floor((now - startedMs) / 1000);
    return Math.max(0, snapshot.total_time_seconds - elapsed);
  }, [snapshot?.started_at, snapshot?.total_time_seconds, now]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await api.post(`/quiz-rooms/${code}/start`);
    } catch (err) {
      showApiError(err, "Failed to start room.");
    } finally {
      setStarting(false);
    }
  };

  const handleEnd = async () => {
    setEnding(true);
    try {
      await api.post(`/quiz-rooms/${code}/end`);
      setConfirmEndOpen(false);
    } catch (err) {
      showApiError(err, "Failed to end room.");
    } finally {
      setEnding(false);
    }
  };

  const handleAnswer = useCallback(
    async (questionId: string, selectedOption: string | null, isSkipped: boolean) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const res = await api.post<LiveQuizRoomSnapshot>(
          `/quiz-rooms/${code}/answer`,
          { question_id: questionId, selected_option: selectedOption, is_skipped: isSkipped },
        );
        setSnapshot(res.data);
        snapshotRef.current = res.data;
      } catch (err) {
        showApiError(err, "Could not save answer.");
      } finally {
        setSubmitting(false);
      }
    },
    [code, submitting, showApiError],
  );

  const handleSkip = useCallback((qid: string) => handleAnswer(qid, null, true), [handleAnswer]);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await api.post<LiveQuizRoomSnapshot>(`/quiz-rooms/${code}/complete`);
      setSnapshot(res.data);
      snapshotRef.current = res.data;
      setConfirmFinishOpen(false);
    } catch (err) {
      showApiError(err, "Failed to submit.");
    } finally {
      setCompleting(false);
    }
  };

  if (!snapshot) return <LoadingSpinner fullPage />;

  const youFinished = snapshot.you_finished;
  const currentQuestion = snapshot.questions[currentIdx];
  const myAnswer = currentQuestion ? snapshot.your_answers[currentQuestion.id] : undefined;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      <PageHeader
        title={snapshot.quiz_name}
        subtitle={
          snapshot.status === "lobby" ? "Waiting for host to start" :
          snapshot.status === "active" ? `Time left ${formatTime(remaining)}` :
          "Room finished"
        }
        backButton={{ label: "Quizzes", onClick: () => navigate("/quiz-sets") }}
        actions={
          isHost && snapshot.status !== "finished" ? (
            <Button color="danger" variant="outline" size="sm" onClick={() => setConfirmEndOpen(true)} loading={ending}>
              End Room
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 bg-primary-50 border border-primary-200 rounded-lg px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-primary-700">Room Code</div>
          <div className="text-2xl font-mono font-bold tracking-widest text-primary-900">
            {snapshot.code}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-600 dark:text-gray-300">Participants</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            {snapshot.participants.filter((p) => p.role === "player").length}
          </div>
        </div>
      </div>

      {snapshot.status === "lobby" && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-3">In the Room</h2>
            {snapshot.participants.length === 0 ? (
              <EmptyState
                icon={<span>👥</span>}
                title="No one here yet"
                description="Share the room code with your friends"
              />
            ) : (
              <ul className="space-y-2">
                {snapshot.participants.map((p) => (
                  <li key={p.user_id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                    <span className={`w-2 h-2 rounded-full ${p.connected ? "bg-green-500" : "bg-gray-300"}`} />
                    <span className="flex-1 text-sm text-gray-800 dark:text-gray-100">{p.name}</span>
                    {p.role === "host" && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">host</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {isHost && (
              <Button
                color="success"
                size="lg"
                onClick={handleStart}
                loading={starting}
                disabled={snapshot.participants.filter((p) => p.role === "player").length === 0}
                className="mt-6"
              >
                Start Quiz for Everyone
              </Button>
            )}
          </div>
          <LiveLeaderboard
            entries={snapshot.leaderboard}
            currentUserId={user?.id}
            emptyMessage="No scores yet"
            title="Standings"
          />
        </div>
      )}

      {snapshot.status === "active" && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            {youFinished ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                <div className="text-4xl mb-2">🏁</div>
                <h3 className="text-lg font-semibold mb-1">You're done!</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Waiting for others to finish...</p>
              </div>
            ) : !isPlayer ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  You're hosting. Watch the leaderboard on the right.
                </p>
              </div>
            ) : currentQuestion ? (
              <>
                <div className="flex gap-1 flex-wrap">
                  {snapshot.questions.map((q, i) => {
                    const a = snapshot.your_answers[q.id];
                    const answered = !!a && (a.selected_option || a.is_skipped);
                    const isCurrent = i === currentIdx;
                    return (
                      <button
                        key={q.id}
                        onClick={() => setCurrentIdx(i)}
                        className={`w-8 h-8 rounded text-xs font-medium ${
                          isCurrent ? "bg-primary-600 text-white" :
                          answered ? "bg-green-100 text-green-700 border border-green-300" :
                          "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>

                <QuestionCard
                  question={currentQuestion}
                  questionNumber={currentIdx + 1}
                  totalQuestions={snapshot.questions.length}
                  selectedAnswer={myAnswer?.selected_option ?? null}
                  isSkipped={!!myAnswer?.is_skipped}
                  onSubmit={handleAnswer}
                  onSkip={handleSkip}
                  onNext={() => setCurrentIdx((i) => Math.min(snapshot.questions.length - 1, i + 1))}
                  onPrevious={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  canGoNext={currentIdx < snapshot.questions.length - 1}
                  canGoPrevious={currentIdx > 0}
                  disabled={submitting}
                />

                <Button color="primary" variant="outline" onClick={() => setConfirmFinishOpen(true)} loading={completing}>
                  Finish Quiz
                </Button>
              </>
            ) : (
              <EmptyState icon={<span>📋</span>} title="No questions" description="This quiz has no questions." />
            )}
          </div>
          <LiveLeaderboard
            entries={snapshot.leaderboard}
            currentUserId={user?.id}
            title="Live Standings"
          />
        </div>
      )}

      {snapshot.status === "finished" && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-2">🎉 Quiz Complete</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Final scores are in. See how you ranked on the right.
            </p>
            <Button
              color="primary"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() =>
                snapshot.quiz_source === "book"
                  ? navigate(`/self-study/books/${snapshot.book_id}`)
                  : navigate(`/quiz-sets/${snapshot.quiz_set_id}`)
              }
            >
              Back to Quiz
            </Button>
          </div>
          <LiveLeaderboard
            entries={snapshot.leaderboard}
            currentUserId={user?.id}
            revealScores
            title="Final Leaderboard"
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmFinishOpen}
        title="Finish your quiz?"
        message="You won't be able to change answers after submitting."
        confirmLabel="Finish"
        onConfirm={handleComplete}
        onCancel={() => setConfirmFinishOpen(false)}
        loading={completing}
      />

      <ConfirmDialog
        open={confirmEndOpen}
        title="End room for everyone?"
        message="This will finalize the quiz for all participants."
        variant="danger"
        confirmLabel="End Room"
        onConfirm={handleEnd}
        onCancel={() => setConfirmEndOpen(false)}
        loading={ending}
      />
    </div>
  );
}
