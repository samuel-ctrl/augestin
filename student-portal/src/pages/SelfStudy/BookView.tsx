import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { VideoPlayer, Breadcrumb, LoadingSpinner, EmptyState, extractErrorMessage } from "@shared";
import type { Book, Subject, BreadcrumbSegment } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";
import QuizPanel from "./QuizPanel";

type Tab = "record" | "quiz";

export default function BookView() {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("record");

  const fetchData = useCallback(async () => {
    try {
      const bookRes = await api.get(`/books/${bookId}`);
      const bookData = bookRes.data;
      setBook(bookData);

      const subjectRes = await api.get(`/subjects/${bookData.subject_id}`);
      setSubject(subjectRes.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 403) {
        navigate("/self-study");
      } else {
        setError(extractErrorMessage(err, "Failed to load book. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }, [bookId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => { setError(null); setLoading(true); fetchData(); } }}
      />
    );
  }
  if (!book || !subject) return null;

  const hasQuestions = (book.question_count ?? 0) > 0;

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Self-Study", path: "/self-study" },
    { label: subject.name, path: `/self-study/subjects/${subject.id}` },
    { label: book.title },
  ];

  return (
    <div>
      <div className="mb-6">
        <Breadcrumb segments={breadcrumbs} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setActiveTab("record")}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
            activeTab === "record"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Record
        </button>
        {hasQuestions ? (
          <button
            onClick={() => setActiveTab("quiz")}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "quiz"
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Quiz
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === "quiz"
                ? "bg-white/20 text-white"
                : "bg-primary-100 text-primary-600"
            }`}>
              {book.question_count}
            </span>
          </button>
        ) : (
          <button
            className="px-4 py-2 text-sm rounded-lg font-medium bg-gray-100 text-gray-400 cursor-not-allowed flex items-center gap-1"
            disabled
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Quiz
          </button>
        )}
      </div>

      {activeTab === "record" ? (
        <div>
          {/* Video Player */}
          <VideoPlayer src={assetUrl(book.video_url)} />

          {/* Book Details */}
          <div className="mt-6">
            <h1 className="text-xl font-semibold text-gray-800">
              {book.title}
            </h1>
            <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
              Standard: {book.standard}th
            </span>
            {book.description && (
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                {book.description}
              </p>
            )}
          </div>
        </div>
      ) : (
        <QuizPanel bookId={bookId!} />
      )}
    </div>
  );
}
