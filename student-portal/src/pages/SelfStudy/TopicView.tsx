import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { VideoPlayer, LoadingSpinner, EmptyState, RecapViewer, PageHeader, extractErrorMessage } from "@shared";
import type { Topic, TopicNotes } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";
import QuizPanel from "./QuizPanel";

type Tab = "video" | "notes" | "quiz";

export default function TopicView() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [notes, setNotes] = useState<TopicNotes | null>(null);
  const [isWatched, setIsWatched] = useState(false);
  const [markingWatched, setMarkingWatched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("video");

  const fetchData = useCallback(async () => {
    if (!topicId) return;
    try {
      const topicRes = await api.get<Topic>(`/topics/${topicId}`);
      const t = topicRes.data;
      setTopic(t);

      const parallel: Promise<any>[] = [];

      if (t.has_notes) {
        parallel.push(
          api.get<TopicNotes>(`/topics/${topicId}/notes`)
            .then((res) => setNotes(res.data))
            .catch(() => {})
        );
      }

      if (t.video_url) {
        parallel.push(
          api.get<{ is_watched: boolean }>(`/topics/${topicId}/watch-status`)
            .then((res) => setIsWatched(res.data.is_watched))
            .catch(() => {})
        );
      }

      await Promise.all(parallel);

      // Set default tab based on what's available
      if (t.video_url) {
        setActiveTab("video");
      } else if (t.has_notes) {
        setActiveTab("notes");
      } else if (t.question_count > 0) {
        setActiveTab("quiz");
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 403) {
        navigate(-1);
      } else {
        setError(extractErrorMessage(err, "Failed to load topic. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }, [topicId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkWatched = async () => {
    if (!topicId) return;
    setMarkingWatched(true);
    try {
      await api.post(`/topics/${topicId}/mark-watched`);
      setIsWatched(true);
    } catch {
      // silently fail
    } finally {
      setMarkingWatched(false);
    }
  };

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
  if (!topic) return null;

  const tabs: { key: Tab; label: string }[] = [];
  if (topic.video_url) tabs.push({ key: "video", label: "Video" });
  if (topic.has_notes) tabs.push({ key: "notes", label: "Notes" });
  if (topic.question_count > 0) tabs.push({ key: "quiz", label: `Quiz (${topic.question_count})` });

  const tabClass = (key: Tab) =>
    `px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
      activeTab === key
        ? "bg-primary-600 text-white"
        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
    }`;

  return (
    <div>
      <PageHeader
        title={topic.title}
        backButton={{ label: "Back to Book", onClick: () => navigate(`/self-study/books/${topic.book_id}`) }}
      />

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex gap-1 mb-4 flex-wrap">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={tabClass(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Video tab */}
      {activeTab === "video" && topic.video_url && (
        <div>
          <VideoPlayer src={assetUrl(topic.video_url)} />

          <div className="mt-4">
            {isWatched ? (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium rounded-lg border border-green-200 dark:border-green-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Watched
              </span>
            ) : (
              <button
                onClick={handleMarkWatched}
                disabled={markingWatched}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {markingWatched ? "Saving..." : "Mark as Watched"}
              </button>
            )}
          </div>

          <div className="mt-6">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{topic.title}</h1>
          </div>
        </div>
      )}

      {/* Notes tab */}
      {activeTab === "notes" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {notes ? (
            <RecapViewer content={notes.content} title={notes.title} />
          ) : (
            <EmptyState
              icon={<span>📄</span>}
              title="No notes yet"
              description="Your tutor hasn't added notes for this topic yet."
            />
          )}
        </div>
      )}

      {/* Quiz tab */}
      {activeTab === "quiz" && (
        <QuizPanel quizSource="topic" quizId={topicId!} />
      )}
    </div>
  );
}
