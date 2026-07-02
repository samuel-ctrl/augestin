import { VideoPlayer, RecapViewer, EmptyState, LoadingSpinner } from "@shared";
import type { Topic, TopicNotes } from "@shared";
import { assetUrl } from "../../api/config";
import QuizPanel from "./QuizPanel";

export type ContentTab = "record" | "quiz" | "recap";

interface TopicContentPanelProps {
  topic: Topic | null;
  notes: TopicNotes | null;
  activeTab: ContentTab;
  isWatched: boolean;
  markingWatched: boolean;
  onMarkWatched: () => void;
  onQuizCompletedChange: (completed: boolean) => void;
}

export default function TopicContentPanel({
  topic,
  notes,
  activeTab,
  isWatched,
  markingWatched,
  onMarkWatched,
  onQuizCompletedChange,
}: TopicContentPanelProps) {
  if (!topic) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{topic.title}</h2>

      {activeTab === "record" && (
        topic.video_url ? (
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
                  onClick={onMarkWatched}
                  disabled={markingWatched}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {markingWatched ? "Saving..." : "Mark as Watched"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <EmptyState icon={<span>🎬</span>} title="No video for this topic" description="Your tutor hasn't added a video yet." />
        )
      )}

      {activeTab === "recap" && (
        notes ? (
          <RecapViewer content={notes.content} title={notes.title} />
        ) : (
          <EmptyState icon={<span>📄</span>} title="No notes yet" description="Your tutor hasn't added notes for this topic yet." />
        )
      )}

      {activeTab === "quiz" && (
        <QuizPanel key={topic.id} quizSource="topic" quizId={topic.id} onCompletedChange={onQuizCompletedChange} />
      )}
    </div>
  );
}
