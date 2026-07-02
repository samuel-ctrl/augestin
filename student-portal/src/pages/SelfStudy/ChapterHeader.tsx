import { isGoogleDriveUrl, toDirectImageUrl } from "@shared";
import type { Book, Subject } from "@shared";
import { assetUrl } from "../../api/config";
import ProgressRing from "./ProgressRing";

const DEFAULT_THUMBNAIL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200' fill='%23e5e7eb'%3E%3Crect width='300' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='40'%3E%F0%9F%93%96%3C/text%3E%3C/svg%3E";

interface ChapterHeaderProps {
  book: Book;
  subject: Subject;
  percentComplete: number;
  allComplete: boolean;
  onContinueLearning: () => void;
  onBack: () => void;
}

export default function ChapterHeader({ book, subject, percentComplete, allComplete, onContinueLearning, onBack }: ChapterHeaderProps) {
  return (
    <div
      className="mb-6 rounded-2xl p-5 sm:p-6 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d47a1 0%, rgba(21, 101, 192, 0.8) 50%, #0d47a1 100%)" }}
    >
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-28 h-28 bg-blue-300/15 rounded-full" />
      <div className="absolute -bottom-4 left-[45%] -translate-x-1/2 w-20 h-20 bg-blue-400/12 rounded-full" />

      <button
        onClick={onBack}
        className="relative z-10 text-sm text-blue-200 hover:text-white mb-3 inline-flex items-center gap-1 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {subject.name}
      </button>

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <img
          src={
            book.thumbnail_url
              ? (isGoogleDriveUrl(book.thumbnail_url) ? toDirectImageUrl(book.thumbnail_url) : assetUrl(book.thumbnail_url))
              : DEFAULT_THUMBNAIL
          }
          alt=""
          className="w-full sm:w-32 h-32 rounded-xl object-cover shrink-0 bg-white/10"
          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_THUMBNAIL; }}
        />

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-blue-200 uppercase tracking-wide mb-1">
            {book.standard} &middot; {subject.name}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{book.title}</h1>
          {book.description && (
            <p className="text-sm text-blue-100 mt-1 line-clamp-2">{book.description}</p>
          )}
          {!allComplete && (
            <button
              onClick={onContinueLearning}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-white text-primary-700 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Continue Learning
            </button>
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
