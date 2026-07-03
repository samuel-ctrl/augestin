import { Sparkles, Video, ArrowRight } from "lucide-react";
import { Card, Button } from "@shared";
import type { TopicProgress } from "@shared";

interface RecommendedNextCardProps {
  nextTopic: TopicProgress | null;
  onSelect: (topicId: string) => void;
}

export default function RecommendedNextCard({ nextTopic, onSelect }: RecommendedNextCardProps) {
  if (!nextTopic) return null;

  return (
    <Card icon={<Sparkles className="w-4 h-4 text-primary-500" />} title="Recommended Next">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{nextTopic.topic_title}</p>
          {nextTopic.has_video && (
            <p className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <Video className="w-3 h-3" /> Video lesson
            </p>
          )}
        </div>
        <Button color="primary" onClick={() => onSelect(nextTopic.topic_id)} className="shrink-0">
          Continue
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
