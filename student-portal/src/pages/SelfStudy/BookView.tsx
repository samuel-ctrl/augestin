import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { VideoPlayer, LoadingSpinner, EmptyState, RecapViewer, PageHeader, extractErrorMessage } from "@shared";
import type { Book, Subject, Doubt, PaginatedResponse } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";
import QuizPanel from "./QuizPanel";

type Tab = "record" | "quiz" | "recap" | "test" | "doubts";

export default function BookView() {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("record");
  const [recap, setRecap] = useState<any | null>(null);
  const [test, setTest] = useState<any | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [testSubmissionLink, setTestSubmissionLink] = useState("");
  const [bookDoubts, setBookDoubts] = useState<Doubt[]>([]);
  const [doubtsCount, setDoubtsCount] = useState(0);

  const fetchTestData = useCallback(async () => {
    if (!bookId) return;
    try {
      setTestLoading(true);
      const testRes = await api.get(`/books/${bookId}/test`);
      if (testRes.data) {
        setTest(testRes.data);
        const statusRes = await api.get(`/books/${bookId}/test/my-submission`);
        setTestSubmitted(statusRes.data.has_submitted);
        setTestSubmissionLink(statusRes.data.submission_link || "");
      }
    } catch (err) {
      // Silently fail if test doesn't exist or endpoint returns error
      setTest(null);
    } finally {
      setTestLoading(false);
    }
  }, [bookId]);

  const fetchData = useCallback(async () => {
    try {
      const bookRes = await api.get(`/books/${bookId}`);
      const bookData = bookRes.data;
      setBook(bookData);

      const [subjectRes, recapRes] = await Promise.all([
        api.get(`/subjects/${bookData.subject_id}`),
        api.get(`/books/${bookId}/recap`).catch(() => ({ data: null })),
      ]);
      setSubject(subjectRes.data);
      setRecap(recapRes.data);

      // Fetch test data and doubts in parallel
      if (bookId) {
        fetchTestData();
        api.get<PaginatedResponse<Doubt>>(`/books/${bookId}/doubts`, { params: { page: 1, page_size: 10 } })
          .then((res) => { setBookDoubts(res.data.items); setDoubtsCount(res.data.total); })
          .catch(() => {});
      }
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
  }, [bookId, navigate, fetchTestData]);

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

  return (
    <div>
      <PageHeader
        title={book.title}
        subtitle={subject.name}
        backButton={{ label: subject.name, onClick: () => navigate(`/self-study/subjects/${subject.id}`) }}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setActiveTab("record")}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
            activeTab === "record"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
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
            className="px-4 py-2 text-sm rounded-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed flex items-center gap-1"
            disabled
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Quiz
          </button>
        )}
        {recap && (
          <button
            onClick={() => setActiveTab("recap")}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              activeTab === "recap"
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Recap
          </button>
        )}
        {test && !testLoading ? (
          <button
            onClick={() => setActiveTab("test")}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "test"
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Test
            {testSubmitted && (
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            )}
          </button>
        ) : null}
        <button
          onClick={() => setActiveTab("doubts")}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === "doubts"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Doubts
          {doubtsCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === "doubts"
                ? "bg-white/20 text-white"
                : "bg-primary-100 text-primary-600"
            }`}>
              {doubtsCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === "record" && (
        <div>
          {/* Video Player */}
          <VideoPlayer src={assetUrl(book.video_url)} />

          {/* Book Details */}
          <div className="mt-6">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              {book.title}
            </h1>
            <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
              Standard: {book.standard}th
            </span>
            {book.description && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {book.description}
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === "quiz" && (
        <QuizPanel quizSource="book" quizId={bookId!} />
      )}

      {activeTab === "recap" && recap && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <RecapViewer content={recap.content} title={recap.title} />
        </div>
      )}

      {activeTab === "test" && test && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">Test</h2>

          {test.instructions && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Instructions:</h3>
              <p className="text-sm text-blue-800 whitespace-pre-wrap">{test.instructions}</p>
            </div>
          )}

          <div className="mb-6">
            <a
              href={test.drive_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Open Test File
            </a>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Submit Your Answer</h3>
            {testSubmitted ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Submitted
                </div>
                {testSubmissionLink && (
                  <a
                    href={testSubmissionLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:underline block truncate"
                  >
                    {testSubmissionLink}
                  </a>
                )}
                <button
                  disabled={testSubmitting}
                  onClick={async () => {
                    setTestSubmitting(true);
                    try {
                      await api.put(`/books/${bookId}/test/submit`, {});
                      setTestSubmitted(false);
                      setTestSubmissionLink("");
                    } catch {
                      // silently fail
                    } finally {
                      setTestSubmitting(false);
                    }
                  }}
                  className="px-4 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  {testSubmitting ? "Saving..." : "Undo Submission"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="url"
                  value={testSubmissionLink}
                  onChange={(e) => setTestSubmissionLink(e.target.value)}
                  placeholder="Paste your Google Drive answer link..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-500"
                />
                <button
                  disabled={testSubmitting || !testSubmissionLink.trim()}
                  onClick={async () => {
                    setTestSubmitting(true);
                    try {
                      const res = await api.put(`/books/${bookId}/test/submit`, {
                        submission_link: testSubmissionLink.trim() || null,
                      });
                      setTestSubmitted(res.data.has_submitted);
                      setTestSubmissionLink(res.data.submission_link || "");
                    } catch {
                      // silently fail
                    } finally {
                      setTestSubmitting(false);
                    }
                  }}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testSubmitting ? "Submitting..." : "Submit Test"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "doubts" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              Doubts ({doubtsCount})
            </h2>
            <button
              onClick={() => navigate(`/doubts/new?book_id=${bookId}`)}
              className="px-4 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
            >
              + Ask a Doubt
            </button>
          </div>

          {bookDoubts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No doubts for this book yet. Be the first to ask!</p>
          ) : (
            <div className="space-y-3">
              {bookDoubts.map((doubt) => (
                <div
                  key={doubt.id}
                  onClick={() => navigate(`/doubts/${doubt.id}`)}
                  className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-50">{doubt.title}</h3>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                      doubt.status === "open" ? "bg-yellow-100 text-yellow-800" :
                      doubt.status === "resolved" ? "bg-green-100 text-green-800" :
                      "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    }`}>
                      {doubt.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1">{doubt.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-gray-500">
                    <span>{doubt.student_name}</span>
                    <span>{doubt.comment_count} comments</span>
                  </div>
                </div>
              ))}
              {doubtsCount > bookDoubts.length && (
                <button
                  onClick={() => navigate(`/doubts?book_id=${bookId}`)}
                  className="text-sm text-primary-600 hover:underline"
                >
                  View all {doubtsCount} doubts
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
