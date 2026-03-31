import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { LoadingSpinner, EmptyState, PageHeader, extractErrorMessage } from "@shared";
import type { QuizSet } from "@shared";
import api from "../../api/client";
import QuizPanel from "../SelfStudy/QuizPanel";

export default function QuizSetView() {
  const { id: quizSetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quizSet, setQuizSet] = useState<QuizSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get(`/quiz-sets/${quizSetId}`);
        setQuizSet(res.data);
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
    </div>
  );
}
