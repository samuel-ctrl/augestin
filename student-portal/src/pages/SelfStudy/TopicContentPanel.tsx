import { CheckCircle2, Video, FileX } from "lucide-react";
import { VideoPlayer, RecapViewer, EmptyState, LoadingSpinner, Button } from "@shared";
import type { Topic, TopicNotes } from "@shared";
import { assetUrl } from "../../api/config";
import QuizPanel from "./QuizPanel";

export type ContentTab = "record" | "quiz" | "notes";

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
    return <LoadingSpinner />;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{topic.title}</h2>

      {activeTab === "record" && (
        topic.video_url ? (
          <div>
            <VideoPlayer src={assetUrl(topic.video_url)} />
            <div className="mt-4">
              {isWatched ? (
                <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium rounded-lg border border-green-200 dark:border-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Watched
                </span>
              ) : (
                <Button color="primary" onClick={onMarkWatched} loading={markingWatched}>
                  Mark as Watched
                </Button>
              )}
            </div>
          </div>
        ) : (
          <EmptyState icon={<Video className="w-6 h-6" />} title="No video for this topic" description="Your tutor hasn't added a video yet." />
        )
      )}

      {activeTab === "notes" && (
        notes ? (
          <RecapViewer content={notes.content} title={notes.title} />
        ) : (
          <EmptyState icon={<FileX className="w-6 h-6" />} title="No notes yet" description="Your tutor hasn't added notes for this topic yet." />
        )
      )}

      {activeTab === "quiz" && (
        <QuizPanel key={topic.id} quizSource="topic" quizId={topic.id} onCompletedChange={onQuizCompletedChange} />
      )}
    </div>
  );
}
