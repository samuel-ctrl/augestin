import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Button, Toast, useToast } from "@shared";
import type { LiveQuizRoomSnapshot } from "@shared";
import api from "../../api/client";

export default function LiveQuizJoin() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const { toast, showApiError, dismiss } = useToast();

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return;
    setJoining(true);
    try {
      const res = await api.post<LiveQuizRoomSnapshot>(
        `/quiz-rooms/${trimmed}/join`
      );
      navigate(
        `/quiz-sets/${res.data.quiz_set_id}/live/${res.data.code}`
      );
    } catch (err) {
      showApiError(err, "Could not join room. Check the code and try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title="Join a Live Quiz"
        subtitle="Enter the room code shared by your tutor or classmate"
        backButton={{ label: "Quizzes", onClick: () => navigate("/quiz-sets") }}
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 max-w-md">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          Room code
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          maxLength={8}
          autoFocus
          placeholder="ABC234"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-500"
        />
        <Button
          color="primary"
          onClick={handleJoin}
          loading={joining}
          disabled={code.trim().length < 4}
          className="mt-4 w-full"
        >
          Join Room
        </Button>

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          To host your own room, open a quiz from{" "}
          <button
            onClick={() => navigate("/quiz-sets")}
            className="text-primary-600 hover:underline"
          >
            Quizzes
          </button>{" "}
          and tap <strong>Play Live with Friends</strong>.
        </p>
      </div>
    </div>
  );
}
