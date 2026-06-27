import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { LoadingSpinner, EmptyState, PageHeader, extractErrorMessage } from "@shared";
import type { Book, Subject, Doubt, TopicProgress, PaginatedResponse } from "@shared";
import api from "../../api/client";

type Tab = "topics" | "doubts";

export default function BookView() {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topicsProgress, setTopicsProgress] = useState<TopicProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("topics");
  const [test, setTest] = useState<any | null>(null);
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [testSubmissionLink, setTestSubmissionLink] = useState("");
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [doubtsCount, setDoubtsCount] = useState(0);

  const fetchData = useCallback(async () => {
    if (!bookId) return;
    try {
      const [bookRes, progressRes] = await Promise.all([
        api.get(`/books/${bookId}`),
        api.get(`/books/${bookId}/topic-progress`),
      ]);
      const bookData: Book = bookRes.data;
      setBook(bookData);
      setTopicsProgress(progressRes.data || []);

      const [subjectRes] = await Promise.all([
        api.get(`/subjects/${bookData.subject_id}`),
      ]);
      setSubject(subjectRes.data);

      // Load test + doubts in background
      api.get(`/books/${bookId}/test`)
        .then(async (res) => {
          if (res.data) {
            setTest(res.data);
            const statusRes = await api.get(`/books/${bookId}/test/my-submission`).catch(() => ({ data: { has_submitted: false, submission_link: "" } }));
            setTestSubmitted(statusRes.data.has_submitted);
            setTestSubmissionLink(statusRes.data.submission_link || "");
          }
        })
        .catch(() => {});

      api.get<PaginatedResponse<Doubt>>(`/books/${bookId}/doubts`, { params: { page: 1, page_size: 10 } })
        .then((res) => { setDoubts(res.data.items); setDoubtsCount(res.data.total); })
        .catch(() => {});
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 403) {
        navigate(-1);
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

  const completedCount = topicsProgress.filter((t) => t.is_complete).length;
  const totalCount = topicsProgress.length;
  const allComplete = totalCount > 0 && completedCount === totalCount;

  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
      activeTab === tab
        ? "bg-primary-600 text-white"
        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
    }`;

  return (
    <div>
      <PageHeader
        title={book.title}
        subtitle={subject.name}
        backButton={{ label: subject.name, onClick: () => navigate(`/self-study/subjects/${subject.id}`) }}
      />

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-300 font-medium">
              {completedCount}/{totalCount} topics complete
            </span>
            {allComplete && (
              <span className="text-green-600 text-xs font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                All done!
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${allComplete ? "bg-green-500" : "bg-primary-500"}`}
              style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button onClick={() => setActiveTab("topics")} className={tabClass("topics")}>
          Topics
        </button>
        <button onClick={() => setActiveTab("doubts")} className={`${tabClass("doubts")} flex items-center gap-1.5`}>
          Doubts
          {doubtsCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === "doubts" ? "bg-white/20 text-white" : "bg-primary-100 text-primary-600"
            }`}>{doubtsCount}</span>
          )}
        </button>
      </div>

      {/* Topics tab */}
      {activeTab === "topics" && (
        <div className="space-y-3">
          {topicsProgress.length === 0 ? (
            <EmptyState
              icon={<span>📚</span>}
              title="No topics yet"
              description="Your tutor hasn't added any topics to this book yet."
            />
          ) : (
            topicsProgress.map((tp, idx) => {
              const isLocked = !tp.is_unlocked;
              return (
                <button
                  key={tp.topic_id}
                  disabled={isLocked}
                  onClick={() => !isLocked && navigate(`/self-study/topics/${tp.topic_id}`)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-colors ${
                    isLocked
                      ? "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60"
                      : tp.is_complete
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {/* Position badge */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    isLocked
                      ? "bg-gray-200 dark:bg-gray-700 text-gray-400"
                      : tp.is_complete
                      ? "bg-green-500 text-white"
                      : "bg-primary-600 text-white"
                  }`}>
                    {isLocked ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    ) : tp.is_complete ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>

                  {/* Title + badges */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      isLocked ? "text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-100"
                    }`}>
                      {tp.topic_title}
                    </p>
                    <div className="flex gap-1.5 mt-1">
                      {tp.has_video && (
                        <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                          tp.video_complete ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          Video{tp.video_complete ? " ✓" : ""}
                        </span>
                      )}
                      {tp.question_count > 0 && (
                        <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                          tp.quiz_complete ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          Quiz{tp.quiz_complete ? " ✓" : ` (${tp.question_count})`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  {!isLocked && (
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              );
            })
          )}

          {/* Test section — gated */}
          {allComplete && (
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-1">Book Test</h2>
              {test ? (
                <>
                  {test.instructions && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="text-sm font-medium text-blue-900 mb-1">Instructions:</h3>
                      <p className="text-sm text-blue-800 whitespace-pre-wrap">{test.instructions}</p>
                    </div>
                  )}
                  <div className="mb-4">
                    <a
                      href={test.drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
                    >
                      Open Test File
                    </a>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Submit Your Answer</h3>
                    {testSubmitted ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          Submitted
                        </div>
                        {testSubmissionLink && (
                          <a href={testSubmissionLink} target="_blank" rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:underline block truncate"
                          >{testSubmissionLink}</a>
                        )}
                        <button
                          disabled={testSubmitting}
                          onClick={async () => {
                            setTestSubmitting(true);
                            try {
                              await api.put(`/books/${bookId}/test/submit`, {});
                              setTestSubmitted(false);
                              setTestSubmissionLink("");
                            } catch {} finally { setTestSubmitting(false); }
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
                            } catch {} finally { setTestSubmitting(false); }
                          }}
                          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {testSubmitting ? "Submitting..." : "Submit Test"}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No test available for this book yet.</p>
              )}
            </div>
          )}

          {/* Test locked hint */}
          {!allComplete && totalCount > 0 && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Complete all topics to unlock the book test
              </p>
            </div>
          )}
        </div>
      )}

      {/* Doubts tab */}
      {activeTab === "doubts" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Doubts ({doubtsCount})</h2>
            <button
              onClick={() => navigate(`/doubts/new?book_id=${bookId}`)}
              className="px-4 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
            >
              + Ask a Doubt
            </button>
          </div>
          {doubts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No doubts for this book yet. Be the first to ask!</p>
          ) : (
            <div className="space-y-3">
              {doubts.map((doubt) => (
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
                    }`}>{doubt.status}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1">{doubt.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-gray-500">
                    <span>{doubt.student_name}</span>
                    <span>{doubt.comment_count} comments</span>
                  </div>
                </div>
              ))}
              {doubtsCount > doubts.length && (
                <button onClick={() => navigate(`/doubts?book_id=${bookId}`)} className="text-sm text-primary-600 hover:underline">
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
