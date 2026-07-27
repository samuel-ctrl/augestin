import { PlayCircle } from "lucide-react";
import { BookThumbnail, Button } from "@shared";
import type { Book } from "@shared";
import { resolveThumbnailUrl } from "../../utils/media";
import ProgressRing from "./ProgressRing";

interface ChapterHeaderProps {
  book: Book;
  topicCount: number;
  percentComplete: number;
  allComplete: boolean;
  onContinueLearning: () => void;
}

export default function ChapterHeader({ book, topicCount, percentComplete, allComplete, onContinueLearning }: ChapterHeaderProps) {
  return (
    <div
      className="mb-6 rounded-2xl px-4 py-3 sm:px-5 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d47a1 0%, rgba(21, 101, 192, 0.8) 50%, #0d47a1 100%)" }}
    >
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-24 h-24 bg-blue-300/15 rounded-full" />
      <div className="absolute -bottom-4 left-[45%] -translate-x-1/2 w-16 h-16 bg-blue-400/12 rounded-full" />

      <div className="relative z-10 flex items-center gap-3 sm:gap-4">
        <BookThumbnail
          src={resolveThumbnailUrl(book.thumbnail_url)}
          className="w-12 h-14 sm:w-14 sm:h-16 rounded-lg shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="px-2 py-0.5 bg-white/15 text-blue-50 text-xs font-medium rounded-full">
              Std {book.standard}
            </span>
            <span className="px-2 py-0.5 bg-white/15 text-blue-50 text-xs font-medium rounded-full">
              {topicCount} {topicCount === 1 ? "Topic" : "Topics"}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-white leading-tight truncate">{book.title}</h1>
          {book.description && (
            <p className="text-xs text-blue-100 line-clamp-1">{book.description}</p>
          )}
          {!allComplete && (
            <Button color="white" size="sm" onClick={onContinueLearning} className="mt-2">
              <PlayCircle className="w-4 h-4" />
              Continue Learning
            </Button>
          )}
        </div>

        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <ProgressRing percentage={percentComplete} size={52} strokeWidth={5} />
          <span className="text-[11px] text-blue-100">Completed</span>
        </div>
      </div>
    </div>
  );
}
