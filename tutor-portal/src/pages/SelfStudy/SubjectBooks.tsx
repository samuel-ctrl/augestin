import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { BookCard, EmptyState, LoadingSpinner, ConfirmDialog, Toast, useToast, extractErrorMessage } from "@shared";
import type { Subject, Book } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";

export default function SubjectBooks() {
  const { id: subjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [subjectRes, booksRes] = await Promise.all([
        api.get(`/subjects/${subjectId}`),
        api.get(`/subjects/${subjectId}/books`, {
          params: { page: 1, page_size: 100, sort_by: "sort_order", sort_order: "asc" },
        }),
      ]);
      setSubject(subjectRes.data);
      setBooks(booksRes.data.items);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        navigate("/self-study");
      } else {
        setError(extractErrorMessage(err, "Failed to load subject data. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }, [subjectId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/books/${deleteTarget.id}`);
      showSuccess(`Book "${deleteTarget.title}" deleted successfully.`);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      setDeleteTarget(null);
      showApiError(err, "Failed to delete book. Please try again.");
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => { setLoading(true); fetchData(); } }}
      />
    );
  }
  if (!subject) return null;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate("/self-study")}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-flex items-center gap-1"
          >
            &larr; Self-Study
          </button>
          <h1 className="text-xl font-semibold text-gray-800">
            {subject.name}
          </h1>
        </div>
        <button
          onClick={() =>
            navigate(`/self-study/books/new?subject_id=${subjectId}`)
          }
          className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Add Book
        </button>
      </div>

      {books.length === 0 ? (
        <EmptyState
          icon={<span>Book</span>}
          title="No books yet"
          description="Add books with videos to this subject."
          action={{
            label: "Add Book",
            onClick: () =>
              navigate(`/self-study/books/new?subject_id=${subjectId}`),
          }}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {books.map((book) => (
            <BookCard
              key={book.id}
              title={book.title}
              standard={book.standard}
              thumbnailUrl={assetUrl(book.thumbnail_url)}
              onClick={() =>
                navigate(`/self-study/books/${book.id}/edit`)
              }
              questionCount={book.question_count}
              actions={
                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      navigate(`/self-study/books/${book.id}/questions`)
                    }
                    className="text-xs text-primary-500 hover:text-primary-700"
                  >
                    Quiz
                  </button>
                  <button
                    onClick={() =>
                      navigate(`/self-study/books/${book.id}/assign`)
                    }
                    className="text-xs text-primary-500 hover:text-primary-700"
                  >
                    Assign
                  </button>
                  <button
                    onClick={() => setDeleteTarget(book)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Book"
        message={`Delete "${deleteTarget?.title}"? The video, assignments, and progress will be permanently removed.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
