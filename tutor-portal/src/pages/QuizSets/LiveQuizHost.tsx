import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import {
  LoadingSpinner, EmptyState, PageHeader, Button, Toast, useToast,
  LiveLeaderboard, ConfirmDialog,
} from "@shared";
import type {
  LiveQuizRoomSnapshot, LiveQuizLeaderboardEntry, LiveQuizParticipant,
} from "@shared";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useWS } from "../../context/WebSocketContext";

type RoomEventPayload = {
  code?: string;
  started_at?: string;
  total_time_seconds?: number;
  participant?: LiveQuizParticipant;
  user_id?: string;
  leaderboard?: LiveQuizLeaderboardEntry[];
  final_leaderboard?: LiveQuizLeaderboardEntry[];
  reason?: string;
};

function formatTime(total: number): string {
  if (total < 0) total = 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function LiveQuizHost() {
  const { code = "" } = useParams<{ id: string; code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { on } = useWS();
  const { toast, showApiError, dismiss } = useToast();

  const [snapshot, setSnapshot] = useState<LiveQuizRoomSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const snapshotRef = useRef<LiveQuizRoomSnapshot | null>(null);

  const refresh = useCallback(async () => {
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

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (snapshot?.status !== "active") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [snapshot?.status]);

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
      } : prev);
    }));
    unsubs.push(on("quiz-room:participant-joined", (ev) => {
      const p = (ev.payload || {}) as RoomEventPayload;
      if (!matches(p) || !p.participant) return;
      setSnapshot((prev) => {
        if (!prev) return prev;
        if (prev.participants.some((x) => x.user_id === p.participant!.user_id)) return prev;
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
      } : prev);
    }));

    return () => { unsubs.forEach((u) => u()); };
  }, [on, code]);

  const remaining = useMemo(() => {
    if (!snapshot?.started_at) return snapshot?.total_time_seconds ?? 0;
    const startedMs = new Date(snapshot.started_at).getTime();
    const elapsed = Math.floor((now - startedMs) / 1000);
    return Math.max(0, snapshot.total_time_seconds - elapsed);
  }, [snapshot?.started_at, snapshot?.total_time_seconds, now]);

  const handleStart = async () => {
    setStarting(true);
    try { await api.post(`/quiz-rooms/${code}/start`); }
    catch (err) { showApiError(err, "Failed to start room."); }
    finally { setStarting(false); }
  };

  const handleEnd = async () => {
    setEnding(true);
    try {
      await api.post(`/quiz-rooms/${code}/end`);
      setConfirmEndOpen(false);
    } catch (err) { showApiError(err, "Failed to end room."); }
    finally { setEnding(false); }
  };

  if (!snapshot) return <LoadingSpinner fullPage />;

  const isHost = user?.id === snapshot.host_id;
  const players = snapshot.participants.filter((p) => p.role === "player");

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      <PageHeader
        title={`Live: ${snapshot.quiz_name}`}
        subtitle={
          snapshot.status === "lobby" ? "Share the code and start when ready" :
          snapshot.status === "active" ? `Time left ${formatTime(remaining)}` :
          "Session complete"
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

      <div className="mb-4 bg-primary-50 border-2 border-primary-300 rounded-lg p-6 text-center">
        <div className="text-sm text-primary-700 mb-1">Room Code — share with students</div>
        <div className="text-5xl font-mono font-bold tracking-widest text-primary-900">
          {snapshot.code}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-3">
            Players ({players.length})
          </h2>
          {players.length === 0 ? (
            <EmptyState
              icon={<Users className="w-6 h-6" />}
              title="Waiting for players"
              description="Players will appear here as they join"
            />
          ) : (
            <ul className="space-y-2">
              {players.map((p) => (
                <li key={p.user_id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                  <span className={`w-2 h-2 rounded-full ${p.connected ? "bg-green-500" : "bg-gray-300"}`} />
                  <span className="flex-1 text-sm text-gray-800">{p.name}</span>
                  {p.finished && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">done</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isHost && snapshot.status === "lobby" && (
            <Button
              color="success"
              size="lg"
              onClick={handleStart}
              loading={starting}
              disabled={players.length === 0}
              className="mt-6"
            >
              Start Quiz for Everyone
            </Button>
          )}

          {snapshot.status === "finished" && (
            <p className="mt-4 text-sm text-gray-500">
              🎉 Session finished. Final scores on the right.
            </p>
          )}
        </div>
        <LiveLeaderboard
          entries={snapshot.leaderboard}
          revealScores={snapshot.status === "finished"}
          title={snapshot.status === "finished" ? "Final Leaderboard" : "Live Standings"}
          emptyMessage="No scores yet"
        />
      </div>

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
