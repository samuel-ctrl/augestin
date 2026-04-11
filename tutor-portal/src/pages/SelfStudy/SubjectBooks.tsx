import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import {
  BookCard,
  DataTable,
  DropdownMenu,
  EmptyState,
  LoadingSpinner,
  ConfirmDialog,
  Toast,
  useToast,
  extractErrorMessage,
  PageHeader,
} from "@shared";
import type { Subject, Book, ColumnDef, PaginatedResponse, TableQueryParams, DropdownMenuItem } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";

export default function SubjectBooks() {
  const { id: subjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const subjectRes = await api.get(`/subjects/${subjectId}`);
      setSubject(subjectRes.data);
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
        backButton={{ label: "Learn Zone", onClick: () => navigate("/self-study") }}
      />

      <DataTable<Book>
        fetchFn={fetchBooks}
        columns={columns}
        searchPlaceholder="Search books..."
        defaultSortBy="created_at"
        defaultSortOrder="asc"
        onRowClick={(book) => navigate(`/self-study/books/${book.id}/preview`)}
        rowKey={(book) => book.id}
        addButtonLabel="+ Add Book"
        onAddClick={() => navigate(`/self-study/books/new?subject_id=${subjectId}`)}
        actions={(book): DropdownMenuItem[] => [
          { label: "Preview", onClick: () => navigate(`/self-study/books/${book.id}/preview`) },
          { label: "Quiz", onClick: () => navigate(`/self-study/books/${book.id}/questions`) },
          { label: "Assign", onClick: () => navigate(`/self-study/books/${book.id}/assign`) },
          { label: "Edit", onClick: () => navigate(`/self-study/books/${book.id}/edit`) },
          { label: "Delete", onClick: () => setDeleteTarget(book), variant: "danger" },
        ]}
        renderCard={(book, cardActions) => (
          <BookCard
            title={book.title}
            standard={book.standard}
            thumbnailUrl={assetUrl(book.thumbnail_url)}
            onClick={() => navigate(`/self-study/books/${book.id}/preview`)}
            questionCount={book.question_count}
            actions={
              cardActions && (
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu items={cardActions} />
                </div>
              )
            }
          />
        )}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Book"
        alertMessage="The video, assignments, and progress will be permanently removed."
        message={`Are you sure you want to delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete"
        variant="danger"
        countdownSeconds={5}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

