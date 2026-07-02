import type { TopicProgress } from "@shared";

interface TopicsSidebarProps {
  topics: TopicProgress[];
  selectedTopicId: string | null;
  onSelect: (topicId: string) => void;
}

export default function TopicsSidebar({ topics, selectedTopicId, onSelect }: TopicsSidebarProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Chapter Topics
      </h2>

      {topics.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No topics yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-none lg:max-h-[520px] overflow-visible lg:overflow-y-auto pr-1">
          {topics.map((tp, idx) => {
            const isLocked = !tp.is_unlocked;
            const isActive = tp.topic_id === selectedTopicId;
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
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isLocked
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-400"
                    : tp.is_complete
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300"
                }`}>
                  {isLocked ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : tp.is_complete ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>

                <p className={`flex-1 min-w-0 text-sm font-medium truncate ${
                  isLocked ? "text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-100"
                }`}>
                  {tp.topic_title}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
