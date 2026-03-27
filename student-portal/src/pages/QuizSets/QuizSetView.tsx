import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { LoadingSpinner, EmptyState, Breadcrumb, extractErrorMessage } from "@shared";
import type { QuizSet, BreadcrumbSegment } from "@shared";
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

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Quiz Sets", path: "/quiz-sets" },
    { label: quizSet.name },
  ];

  return (
    <div>
      <div className="mb-6">
        <Breadcrumb segments={breadcrumbs} />
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{quizSet.name}</h1>
        {quizSet.description && (
          <p className="text-sm text-gray-600 mt-2">{quizSet.description}</p>
        )}
      </div>

      <QuizPanel quizSource="quiz_set" quizId={quizSetId!} />
    </div>
  );
}
