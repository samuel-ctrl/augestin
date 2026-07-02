import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { LoadingSpinner } from "@shared";
import type { Topic } from "@shared";
import api from "../../api/client";

export default function TopicView() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!topicId) return;
    api.get<Topic>(`/topics/${topicId}`)
      .then((res) => {
        navigate(`/self-study/books/${res.data.book_id}?topic=${topicId}`, { replace: true });
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404 || status === 403) {
          navigate(-1);
        } else {
          navigate("/self-study", { replace: true });
        }
      });
  }, [topicId, navigate]);

  return <LoadingSpinner fullPage />;
}
