import { PlayCircle } from "lucide-react";
import { isGoogleDriveUrl, toDirectImageUrl, BookThumbnail, Button } from "@shared";
import type { Book } from "@shared";
import { assetUrl } from "../../api/config";
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
      className="mb-6 rounded-2xl p-5 sm:p-6 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d47a1 0%, rgba(21, 101, 192, 0.8) 50%, #0d47a1 100%)" }}
    >
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-28 h-28 bg-blue-300/15 rounded-full" />
      <div className="absolute -bottom-4 left-[45%] -translate-x-1/2 w-20 h-20 bg-blue-400/12 rounded-full" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <BookThumbnail
          src={book.thumbnail_url ? (isGoogleDriveUrl(book.thumbnail_url) ? toDirectImageUrl(book.thumbnail_url) : assetUrl(book.thumbnail_url)) : undefined}
          className="w-full sm:w-32 h-32 rounded-xl shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="px-2 py-0.5 bg-white/15 text-blue-50 text-xs font-medium rounded-full">
              Std {book.standard}
            </span>
            <span className="px-2 py-0.5 bg-white/15 text-blue-50 text-xs font-medium rounded-full">
              {topicCount} {topicCount === 1 ? "Topic" : "Topics"}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{book.title}</h1>
          {book.description && (
            <p className="text-sm text-blue-100 mt-1 line-clamp-2">{book.description}</p>
          )}
          {!allComplete && (
            <Button color="white" size="md" onClick={onContinueLearning} className="mt-3">
              <PlayCircle className="w-4 h-4" />
              Continue Learning
            </Button>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 mx-auto sm:mx-0">
          <ProgressRing percentage={percentComplete} />
          <span className="text-xs text-blue-100">Completed</span>
        </div>
      </div>
    </div>
  );
}
