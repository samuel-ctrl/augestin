import { useState, useEffect, useCallback, useRef } from "react";
import { FileX } from "lucide-react";
import { LoadingSpinner, EmptyState, Toast, useToast, RecapViewer, RecapEditor } from "@shared";
import type { BookRecap } from "@shared";
import api from "../../api/client";

interface BookRecapPanelProps {
  bookId: string;
}

export default function BookRecapPanel({ bookId }: BookRecapPanelProps) {
  const { toast, showApiError, showSuccess, dismiss } = useToast();
  const [recap, setRecap] = useState<BookRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const titleRef = useRef<string>("");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<BookRecap | null>(`/books/${bookId}/recap`)
      .then((res) => {
        if (cancelled) return;
        setRecap(res.data);
        titleRef.current = res.data?.title || "";
      })
      .catch((err) => { if (!cancelled) showApiError(err, "Failed to load your recap."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const handleTitleChange = useCallback((title: string) => {
    titleRef.current = title;
  }, []);

  const handleSave = useCallback(async (content: any) => {
    const res = await api.post<BookRecap>(`/books/${bookId}/recap`, {
      title: titleRef.current || "My Recap",
      content,
    });
    setRecap(res.data);
    showSuccess("Recap saved.");
  }, [bookId, showSuccess]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {isMobile ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-1">Editor Not Supported on Mobile</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Writing your recap isn't optimized for mobile yet. Please use a desktop to edit it.
              </p>
            </div>
          </div>
          {recap && (
            <div className="mt-4 pt-4 border-t border-yellow-200 dark:border-yellow-700">
              <div className="bg-white dark:bg-gray-800 rounded p-3 text-sm">
                <RecapViewer content={recap.content} title={recap.title} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <RecapEditor
          onSave={handleSave}
          onTitleChange={handleTitleChange}
          initialTitle={recap?.title}
          initialContent={recap?.content}
          titlePlaceholder="My Recap"
          editorPlaceholder="Write your own recap for this book — key takeaways, formulas, anything worth remembering..."
        />
      )}
    </div>
  );
}
