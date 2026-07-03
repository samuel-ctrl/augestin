import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PlayCircle,
  HelpCircle,
  FileText,
  ClipboardCheck,
  MessageCircleQuestion,
  Lock,
  ExternalLink,
  CheckCircle2,
  Plus,
  AlertTriangle,
  BookOpen,
  PencilRuler,
} from "lucide-react";
import { LoadingSpinner, EmptyState, extractErrorMessage, Card, Button, useSetBreadcrumbs } from "@shared";
import type { Book, Subject, Doubt, Topic, TopicNotes, TopicProgress, PaginatedResponse } from "@shared";
import api from "../../api/client";
import ChapterHeader from "./ChapterHeader";
import TopicsSidebar from "./TopicsSidebar";
import TopicContentPanel, { type ContentTab } from "./TopicContentPanel";
import RecommendedNextCard from "./RecommendedNextCard";

type Tab = ContentTab | "test" | "doubts";
type TabGroup = "study" | "practice";

const TAB_GROUP: Record<Tab, TabGroup> = {
  record: "study",
  quiz: "study",
  recap: "study",
  test: "practice",
  doubts: "practice",
};

const GROUPS: { key: TabGroup; label: string; icon: typeof BookOpen; firstTab: Tab }[] = [
  { key: "study", label: "Study Materials", icon: BookOpen, firstTab: "record" },
  { key: "practice", label: "Practice & Discuss", icon: PencilRuler, firstTab: "test" },
];

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

  useSetBreadcrumbs(
    subject && book
      ? [
          { label: "Learn Zone", path: "/self-study" },
          { label: subject.name, path: `/self-study/subjects/${subject.id}` },
          { label: book.title },
        ]
      : []
  );

  const nextTopic = useMemo(() => {
    const idx = topicsProgress.findIndex((t) => t.topic_id === selectedTopicId);
    if (idx === -1 || idx + 1 >= topicsProgress.length) return null;
    const next = topicsProgress[idx + 1];
    return next.is_complete ? null : next;
  }, [topicsProgress, selectedTopicId]);

  const activeGroup = TAB_GROUP[activeTab];

  // Inner tabs render as an underline tab-bar inside the content card header.
  const tabClass = (tab: Tab) =>
    `inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
      activeTab === tab
        ? "border-primary-600 text-primary-700 dark:text-primary-300"
        : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
    }`;

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        variant="error"
        icon={<AlertTriangle className="w-6 h-6" />}
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
        topicCount={totalCount}
        percentComplete={percentComplete}
        allComplete={allComplete}
        onContinueLearning={handleContinueLearning}
      />

      {/* Top-level stepper: Study Materials → Practice & Discuss */}
      <div className="flex gap-1.5 mb-4 p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full">
        {GROUPS.map((group) => {
          const isActive = activeGroup === group.key;
          const Icon = group.icon;
          return (
            <button
              key={group.key}
              onClick={() => setActiveTab(group.firstTab)}
              aria-current={isActive ? "step" : undefined}
              className={`flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                isActive
                  ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 hidden sm:block" />
              <span className="truncate">{group.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className={activeGroup === "study" ? "lg:col-span-2" : "lg:col-span-3"}>
          <Card padding="none" className="overflow-hidden">
            {/* Inner tabs — the header of this content card, under the stepper */}
            <div className="flex items-center gap-1 border-b border-gray-100 dark:border-gray-800 px-2 sm:px-4 overflow-x-auto">
              {activeGroup === "study" ? (
                <>
                  <button onClick={() => setActiveTab("record")} className={tabClass("record")}>
                    <PlayCircle className="w-3.5 h-3.5" /> Record
                  </button>
                  <button onClick={() => setActiveTab("quiz")} className={tabClass("quiz")}>
                    <HelpCircle className="w-3.5 h-3.5" />
                    Quiz{topicDetail && topicDetail.question_count > 0 ? ` (${topicDetail.question_count})` : ""}
                  </button>
                  <button onClick={() => setActiveTab("recap")} className={tabClass("recap")}>
                    <FileText className="w-3.5 h-3.5" /> Recap
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setActiveTab("test")} className={tabClass("test")}>
                    {allComplete ? <ClipboardCheck className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    Test
                  </button>
                  <button onClick={() => setActiveTab("doubts")} className={tabClass("doubts")}>
                    <MessageCircleQuestion className="w-3.5 h-3.5" />
                    Doubts
                    {doubtsCount > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        activeTab === "doubts"
                          ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300"
                      }`}>{doubtsCount}</span>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Body — changes with the active inner tab */}
            <div className="p-4 sm:p-6">
              {(activeTab === "record" || activeTab === "quiz" || activeTab === "recap") && (
                <TopicContentPanel
                  topic={topicDetail}
                  notes={notes}
                  activeTab={activeTab}
                  isWatched={isWatched}
                  markingWatched={markingWatched}
                  onMarkWatched={handleMarkWatched}
                  onQuizCompletedChange={refetchProgress}
                />
              )}

              {activeTab === "test" && (
                allComplete ? (
                  <>
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
                          <a href={test.drive_link} target="_blank" rel="noopener noreferrer">
                            <Button color="primary">
                              <ExternalLink className="w-4 h-4" />
                              Open Test File
                            </Button>
                          </a>
                        </div>
                        <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Submit Your Answer</h3>
                          {testSubmitted ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 text-sm font-medium">
                                <CheckCircle2 className="w-4 h-4" />
                                Submitted
                              </div>
                              {testSubmissionLink && (
                                <a href={testSubmissionLink} target="_blank" rel="noopener noreferrer"
                                  className="text-sm text-primary-600 hover:underline block truncate"
                                >{testSubmissionLink}</a>
                              )}
                              <Button
                                color="secondary"
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await api.put(`/books/${bookId}/test/submit`, {});
                                    setTestSubmitted(false);
                                    setTestSubmissionLink("");
                                  } catch {}
                                }}
                              >
                                Undo Submission
                              </Button>
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
                              <Button
                                color="primary"
                                disabled={!testSubmissionLink.trim()}
                                onClick={async () => {
                                  try {
                                    const res = await api.put(`/books/${bookId}/test/submit`, {
                                      submission_link: testSubmissionLink.trim() || null,
                                    });
                                    setTestSubmitted(res.data.has_submitted);
                                    setTestSubmissionLink(res.data.submission_link || "");
                                  } catch {}
                                }}
                              >
                                Submit Test
                              </Button>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No test available for this book yet.</p>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      Complete all topics to unlock the book test
                    </p>
                  </div>
                )
              )}

              {activeTab === "doubts" && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Doubts ({doubtsCount})</h2>
                    <Button color="primary" size="sm" onClick={() => navigate(`/doubts/new?book_id=${bookId}`)}>
                      <Plus className="w-3.5 h-3.5" />
                      Ask a Doubt
                    </Button>
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
                        <Button variant="ghost" color="primary" size="sm" onClick={() => navigate(`/doubts?book_id=${bookId}`)}>
                          View all {doubtsCount} doubts
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        {activeGroup === "study" && (
          <div className="lg:col-span-1">
            <TopicsSidebar topics={topicsProgress} selectedTopicId={selectedTopicId} onSelect={setSelectedTopicId} />
          </div>
        )}
      </div>

      {activeGroup === "study" && (
        <RecommendedNextCard nextTopic={nextTopic} onSelect={setSelectedTopicId} />
      )}
    </div>
  );
}
