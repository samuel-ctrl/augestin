import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  BookCard,
  DataTable,
  EmptyState,
  LoadingSpinner,
  ConfirmDialog,
  Toast,
  useToast,
  extractErrorMessage,
  Button,
  PageHeader,
} from "@shared";
import type { Subject, Book, ColumnDef, PaginatedResponse, TableQueryParams } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";

type ViewMode = "table" | "card";

export default function SubjectBooks() {
  const { id: subjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [subjectRes, booksRes] = await Promise.all([
        api.get(`/subjects/${subjectId}`),
        api.get(`/subjects/${subjectId}/books`, {
          params: { page: 1, page_size: 100, sort_by: "created_at", sort_order: "asc" },
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

  const fetchBooks = useCallback(
    async (params: TableQueryParams): Promise<PaginatedResponse<Book>> => {
      const res = await api.get(`/subjects/${subjectId}/books`, { params });
      return res.data;
    },
    [subjectId]
  );

  const columns: ColumnDef<Book>[] = [
    {
      key: "title",
      label: "Title",
      sortable: true,
    },
    {
      key: "standard",
      label: "Standard",
      sortable: true,
      width: "100px",
      render: (value) => (
        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
          Std: {String(value)}
        </span>
      ),
    },
    {
      key: "question_count",
      label: "Questions",
      sortable: true,
      width: "100px",
      render: (value) => {
        const count = Number(value) || 0;
        return count > 0 ? (
          <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs rounded">
            {count} Q{count !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        );
      },
    },
  ];

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
      <PageHeader
        title={subject.name}
        backButton={{ label: "Self-Study", onClick: () => navigate("/self-study") }}
        actions={
          <>
            <div className="flex border border-gray-500 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === "table"
                    ? "bg-white/20 text-white"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode("card")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === "card"
                    ? "bg-white/20 text-white"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
              >
                Cards
              </button>
            </div>
            <Button color="success" onClick={() => navigate(`/self-study/books/new?subject_id=${subjectId}`)}>
              + Add Book
            </Button>
          </>
        }
      />

      {viewMode === "table" ? (
        <DataTable<Book>
          fetchFn={fetchBooks}
          columns={columns}
          searchPlaceholder="Search books..."
          defaultSortBy="created_at"
          defaultSortOrder="asc"
          onRowClick={(book) => navigate(`/self-study/books/${book.id}/preview`)}
          rowKey={(book) => book.id}
          actions={(book) => (
            <BookMenu
              onPreview={() => navigate(`/self-study/books/${book.id}/preview`)}
              onQuiz={() => navigate(`/self-study/books/${book.id}/questions`)}
              onAssign={() => navigate(`/self-study/books/${book.id}/assign`)}
              onEdit={() => navigate(`/self-study/books/${book.id}/edit`)}
              onDelete={() => setDeleteTarget(book)}
            />
          )}
        />
      ) : books.length === 0 ? (
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
                navigate(`/self-study/books/${book.id}/preview`)
              }
              questionCount={book.question_count}
              actions={
                <BookCardActions
                  onPreview={() => navigate(`/self-study/books/${book.id}/preview`)}
                  onQuiz={() => navigate(`/self-study/books/${book.id}/questions`)}
                  onAssign={() => navigate(`/self-study/books/${book.id}/assign`)}
                  onEdit={() => navigate(`/self-study/books/${book.id}/edit`)}
                  onDelete={() => setDeleteTarget(book)}
                />
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

function BookMenu({
  onPreview,
  onQuiz,
  onAssign,
  onEdit,
  onDelete,
}: {
  onPreview: () => void;
  onQuiz: () => void;
  onAssign: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-20 w-36 bg-white rounded-lg border border-gray-200 shadow-lg py-1">
          <button
            onClick={() => handleAction(onPreview)}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview
          </button>
          <button
            onClick={() => handleAction(onEdit)}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button
            onClick={() => handleAction(onQuiz)}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Quiz
          </button>
          <button
            onClick={() => handleAction(onAssign)}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Assign
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={() => handleAction(onDelete)}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function BookCardActions({
  onPreview,
  onQuiz,
  onAssign,
  onEdit,
  onDelete,
}: {
  onPreview: () => void;
  onQuiz: () => void;
  onAssign: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onPreview}
        title="Preview"
        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
      <button
        onClick={onEdit}
        title="Edit"
        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button
        onClick={onQuiz}
        title="Quiz"
        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      <button
        onClick={onAssign}
        title="Assign"
        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      <button
        onClick={onDelete}
        title="Delete"
        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
