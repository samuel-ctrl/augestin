import { ListChecks, Lock, CheckCircle2, PlayCircle, Video, HelpCircle, BookOpen } from "lucide-react";
import { Card, isGoogleDriveUrl, toDirectImageUrl } from "@shared";
import type { TopicProgress } from "@shared";
import { assetUrl } from "../../api/config";

interface TopicsSidebarProps {
  topics: TopicProgress[];
  selectedTopicId: string | null;
  onSelect: (topicId: string) => void;
}

function resolveThumbnailUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return isGoogleDriveUrl(url) ? toDirectImageUrl(url) : assetUrl(url);
}

export default function TopicsSidebar({ topics, selectedTopicId, onSelect }: TopicsSidebarProps) {
  const completedCount = topics.filter((t) => t.is_complete).length;

  return (
    <Card
      icon={<ListChecks className="w-4 h-4" />}
      title="Chapter Topics"
      headerAction={
        topics.length > 0 && (
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 shrink-0">
            {completedCount}/{topics.length} done
          </span>
        )
      }
    >
      {topics.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No topics yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-none lg:max-h-[520px] overflow-visible lg:overflow-y-auto pr-1">
          {topics.map((tp, idx) => {
            const isLocked = !tp.is_unlocked;
            const isActive = tp.topic_id === selectedTopicId;
            const thumbnailSrc = resolveThumbnailUrl(tp.image_url);

            return (
              <button
                key={tp.topic_id}
                disabled={isLocked}
                onClick={() => !isLocked && onSelect(tp.topic_id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                  isLocked
                    ? "opacity-60 cursor-not-allowed"
                    : isActive
                    ? "bg-primary-50 dark:bg-primary-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center border border-gray-200 dark:border-gray-600">
                    {thumbnailSrc ? (
                      <img
                        src={thumbnailSrc}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <BookOpen className="w-4 h-4 text-gray-300 dark:text-gray-500" />
                    )}
                  </div>

                  <div
                    className={`absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-white dark:ring-gray-800 ${
                      isLocked
                        ? "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                        : tp.is_complete
                        ? "bg-green-500 text-white"
                        : isActive
                        ? "bg-primary-600 text-white"
                        : "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300"
                    }`}
                  >
                    {isLocked ? (
                      <Lock className="w-2.5 h-2.5" />
                    ) : tp.is_complete ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : isActive ? (
                      <PlayCircle className="w-3 h-3" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    isLocked ? "text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-100"
                  }`}>
                    {tp.topic_title}
                  </p>
                  {(tp.has_video || tp.question_count > 0) && (
                    <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                      {tp.has_video && (
                        <span className="inline-flex items-center gap-1">
                          <Video className="w-3 h-3" /> Video
                        </span>
                      )}
                      {tp.question_count > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" /> {tp.question_count}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
