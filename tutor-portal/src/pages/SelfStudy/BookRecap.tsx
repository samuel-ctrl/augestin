import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useBlocker } from "react-router-dom";
import { LoadingSpinner, EmptyState, Toast, useToast, ConfirmDialog, Breadcrumb, RecapViewer, Button } from "@shared";
import api from "../../api/client";
import RecapEditor from "../../components/RecapEditor";

interface Book {
  id: string;
  title: string;
  subject_id: string;
}

interface Recap {
  id: string;
  book_id: string;
  created_by: string;
  title: string;
  content: any;
  created_at: string;
  updated_at?: string;
}

export default function BookRecap() {
  const { id: bookId } = useParams<{ id: string }>();
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const [book, setBook] = useState<Book | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const titleRef = useRef<string>("");

  // Block in-app navigation when there are unsaved changes
  const blocker = useBlocker(hasUnsavedChanges);

  // Block browser tab close/refresh when there are unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Detect mobile on mount and on resize
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    setIsMobile(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Fetch book and recap data
  const fetchData = useCallback(async () => {
    if (!bookId) return;

    try {
      setLoading(true);
      const [bookRes, recapRes] = await Promise.all([
        api.get<Book>(`/books/${bookId}`),
        api.get<Recap | null>(`/books/${bookId}/recap`),
      ]);

      setBook(bookRes.data);
      if (recapRes.data) {
        setRecap(recapRes.data);
        titleRef.current = recapRes.data.title;
      } else {
        titleRef.current = "";
      }
    } catch (err) {
      showApiError(err, "Failed to load recap data.");
    } finally {
      setLoading(false);
    }
  }, [bookId, showApiError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = useCallback(
    async (content: any) => {
      if (!bookId) return;

      try {
        const res = await api.post<Recap>(`/books/${bookId}/recap`, {
          title: titleRef.current || "Chapter Summary",
          content,
        });
        setRecap(res.data);
        showSuccess("Recap saved successfully");
      } catch (err) {
        showApiError(err, "Failed to save recap.");
      }
    },
    [bookId, showApiError, showSuccess]
  );

  const handleDelete = useCallback(async () => {
    if (!bookId) return;

    try {
      setDeleting(true);
      await api.delete(`/books/${bookId}/recap`);
      setRecap(null);
      showSuccess("Recap deleted successfully");
      setShowDeleteConfirm(false);
    } catch (err) {
      showApiError(err, "Failed to delete recap.");
    } finally {
      setDeleting(false);
    }
  }, [bookId, showApiError, showSuccess]);

  const handleTitleChange = useCallback((newTitle: string) => {
    titleRef.current = newTitle;
  }, []);

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  if (!book) {
    return (
      <EmptyState
        icon="📚"
        title="Book Not Found"
        description="The book you're looking for doesn't exist."
      />
    );
  }

  return (
    <div className="p-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {/* Breadcrumb */}
      <Breadcrumb
        segments={[
          { label: "Self-Study", path: "/self-study" },
          { label: book.title, path: `/self-study/books/${bookId}/preview` },
          { label: "Manage Recap" },
        ]}
      />

      {/* Header */}
      <div className="mt-6 mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Manage Recap</h1>
        {recap && (
          <Button color="danger" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete Recap"}
          </Button>
        )}
      </div>

      {/* Recap Editor */}
      {isMobile ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">Mobile Editor Not Supported</h3>
              <p className="text-sm text-yellow-700">
                Recap editing is not optimized for mobile devices. Please use a desktop or tablet to edit your recap notes.
              </p>
            </div>
          </div>
          {recap && (
            <div className="mt-4 pt-4 border-t border-yellow-200">
              <p className="text-xs text-yellow-600 mb-3">Current recap content:</p>
              <div className="bg-white rounded p-3 text-sm">
                <RecapViewer content={recap.content} title={recap.title} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <RecapEditor
          bookId={bookId!}
          onSave={handleSave}
          onTitleChange={handleTitleChange}
          onDirtyChange={setHasUnsavedChanges}
          initialTitle={recap?.title}
          initialContent={recap?.content}
        />
      )}

      {/* Unsaved Changes Confirmation */}
      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Unsaved Changes"
        message="Have you saved your changes?"
        confirmLabel="Yes, leave"
        cancelLabel="No, stay"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Recap"
        message="Are you sure you want to delete this recap? This action cannot be undone."
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
}
