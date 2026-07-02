import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import { LoadingSpinner, EmptyState, extractErrorMessage } from "@shared";
import type { Book, Subject, Doubt, Topic, TopicNotes, TopicProgress, PaginatedResponse } from "@shared";
import api from "../../api/client";
import ChapterHeader from "./ChapterHeader";
import TopicsSidebar from "./TopicsSidebar";
import TopicContentPanel, { type ContentTab } from "./TopicContentPanel";
import StatsRow from "./StatsRow";
import RecommendedNextCard from "./RecommendedNextCard";

type Tab = ContentTab | "test" | "doubts";

function getDefaultTopicId(topics: TopicProgress[]): string | null {
  if (topics.length === 0) return null;
  const current = topics.find((t) => t.is_unlocked && !t.is_complete);
  if (current) return current.topic_id;
  const allComplete = topics.every((t) => t.is_complete);
  return allComplete ? topics[topics.length - 1].topic_id : topics[0].topic_id;
}

export default function BookView() {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [book, setBook] = useState<Book | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topicsProgress, setTopicsProgress] = useState<TopicProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("record");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const [test, setTest] = useState<any | null>(null);
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [testSubmissionLink, setTestSubmissionLink] = useState("");
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [doubtsCount, setDoubtsCount] = useState(0);

  const [topicDetail, setTopicDetail] = useState<Topic | null>(null);
  const [notes, setNotes] = useState<TopicNotes | null>(null);
  const [isWatched, setIsWatched] = useState(false);
  const [markingWatched, setMarkingWatched] = useState(false);

  const refetchProgress = useCallback(async () => {
    if (!bookId) return;
    try {
      const res = await api.get<TopicProgress[]>(`/books/${bookId}/topic-progress`);
      setTopicsProgress(res.data || []);
    } catch {
      // silently fail — sidebar/stats just keep last known state
    }
  }, [bookId]);

  const fetchData = useCallback(async () => {
    if (!bookId) return;
    try {
      const [bookRes, progressRes] = await Promise.all([
        api.get(`/books/${bookId}`),
        api.get<TopicProgress[]>(`/books/${bookId}/topic-progress`),
      ]);
      const bookData: Book = bookRes.data;
      setBook(bookData);
      const progress = progressRes.data || [];
      setTopicsProgress(progress);

      const [subjectRes] = await Promise.all([
        api.get(`/subjects/${bookData.subject_id}`),
      ]);
      setSubject(subjectRes.data);

      const topicParam = searchParams.get("topic");
      const initialTopicId =
        (topicParam && progress.some((t) => t.topic_id === topicParam)) ? topicParam : getDefaultTopicId(progress);
      setSelectedTopicId(initialTopicId);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch topic detail whenever the selected topic changes — not on tab switches.
  useEffect(() => {
    if (!selectedTopicId) {
      setTopicDetail(null);
      setNotes(null);
      setIsWatched(false);
      return;
    }
    let cancelled = false;
    setTopicDetail(null);
    setNotes(null);
    setIsWatched(false);

    api.get<Topic>(`/topics/${selectedTopicId}`).then((res) => {
      if (cancelled) return;
      const t = res.data;
      setTopicDetail(t);

      if (t.has_notes) {
        api.get<TopicNotes>(`/topics/${selectedTopicId}/notes`)
          .then((notesRes) => { if (!cancelled) setNotes(notesRes.data); })
          .catch(() => {});
      }
      if (t.video_url) {
        api.get<{ is_watched: boolean }>(`/topics/${selectedTopicId}/watch-status`)
          .then((wsRes) => { if (!cancelled) setIsWatched(wsRes.data.is_watched); })
          .catch(() => {});
      }
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [selectedTopicId]);

  const handleMarkWatched = async () => {
    if (!selectedTopicId) return;
    setMarkingWatched(true);
    try {
      await api.post(`/topics/${selectedTopicId}/mark-watched`);
      setIsWatched(true);
      refetchProgress();
    } catch {
      // silently fail
    } finally {
      setMarkingWatched(false);
    }
  };

  const handleContinueLearning = () => {
    const nextId = getDefaultTopicId(topicsProgress);
    if (nextId) setSelectedTopicId(nextId);
    setActiveTab("record");
  };

  const completedCount = topicsProgress.filter((t) => t.is_complete).length;
  const totalCount = topicsProgress.length;
  const allComplete = totalCount > 0 && completedCount === totalCount;
  const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const videosWatched = useMemo(() => ({
    done: topicsProgress.filter((t) => t.has_video && t.video_complete).length,
    total: topicsProgress.filter((t) => t.has_video).length,
  }), [topicsProgress]);

  const quizAvgScore = useMemo(() => {
    const attempted = topicsProgress.filter((t) => t.question_count > 0 && t.score_percentage != null);
    if (attempted.length === 0) return null;
    return attempted.reduce((sum, t) => sum + (t.score_percentage ?? 0), 0) / attempted.length;
  }, [topicsProgress]);

  const testStatus = !test ? "not_available" : testSubmitted ? "submitted" : "pending";

  const nextTopic = useMemo(() => {
    const idx = topicsProgress.findIndex((t) => t.topic_id === selectedTopicId);
    if (idx === -1 || idx + 1 >= topicsProgress.length) return null;
    const next = topicsProgress[idx + 1];
    return next.is_complete ? null : next;
  }, [topicsProgress, selectedTopicId]);

  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
      activeTab === tab
        ? "bg-primary-600 text-white"
        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
    }`;

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

  return (
    <div>
      <ChapterHeader
        book={book}
        subject={subject}
        percentComplete={percentComplete}
        onContinueLearning={handleContinueLearning}
        onBack={() => navigate(`/self-study/subjects/${subject.id}`)}
      />

      <div className="flex gap-1 mb-4 flex-wrap">
        <button onClick={() => setActiveTab("record")} className={tabClass("record")}>Record</button>
        <button onClick={() => setActiveTab("quiz")} className={tabClass("quiz")}>
          Quiz{topicDetail && topicDetail.question_count > 0 ? ` (${topicDetail.question_count})` : ""}
        </button>
        <button onClick={() => setActiveTab("recap")} className={tabClass("recap")}>Recap</button>
        <button onClick={() => setActiveTab("test")} className={tabClass("test")}>Test</button>
        <button onClick={() => setActiveTab("doubts")} className={`${tabClass("doubts")} flex items-center gap-1.5`}>
          Doubts
          {doubtsCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === "doubts" ? "bg-white/20 text-white" : "bg-primary-100 text-primary-600"
            }`}>{doubtsCount}</span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          {(activeTab === "record" || activeTab === "quiz" || activeTab === "recap") && (
            <TopicContentPanel
              topic={topicDetail}
              notes={notes}
              activeTab={activeTab}
              isWatched={isWatched}
              markingWatched={markingWatched}
              onMarkWatched={handleMarkWatched}
              onQuizCompletedChange={() => refetchProgress()}
            />
          )}

          {activeTab === "test" && (
            allComplete ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
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
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Complete all topics to unlock the book test
                </p>
              </div>
            )
          )}

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

        <div className="lg:col-span-1">
          <TopicsSidebar topics={topicsProgress} selectedTopicId={selectedTopicId} onSelect={setSelectedTopicId} />
        </div>
      </div>

      <StatsRow
        videosWatched={videosWatched}
        topicsComplete={{ done: completedCount, total: totalCount }}
        quizAvgScore={quizAvgScore}
        testStatus={testStatus}
      />

      <RecommendedNextCard nextTopic={nextTopic} onSelect={setSelectedTopicId} />
    </div>
  );
}
