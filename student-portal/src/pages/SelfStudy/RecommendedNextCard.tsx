import type { TopicProgress } from "@shared";

interface RecommendedNextCardProps {
  nextTopic: TopicProgress | null;
  onSelect: (topicId: string) => void;
}

export default function RecommendedNextCard({ nextTopic, onSelect }: RecommendedNextCardProps) {
  if (!nextTopic) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">Recommended Next</h2>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{nextTopic.topic_title}</p>
          {nextTopic.has_video && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Video lesson</p>
          )}
        </div>
        <button
          onClick={() => onSelect(nextTopic.topic_id)}
          className="shrink-0 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
