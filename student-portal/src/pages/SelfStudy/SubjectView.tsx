import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { BookCard, DataTable, EmptyState, LoadingSpinner, Breadcrumb, extractErrorMessage } from "@shared";
import type { Subject, Book, BreadcrumbSegment, ColumnDef, PaginatedResponse, TableQueryParams } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";

type ViewMode = "table" | "card";

export default function SubjectView() {
  const { id: subjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const fetchData = useCallback(async () => {
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
        setError(extractErrorMessage(err, "Failed to load subject. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }, [subjectId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        icon={<span>⚠️</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => { setError(null); setLoading(true); fetchData(); } }}
      />
    );
  }
  if (!subject) return null;

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Self-Study", path: "/self-study" },
    { label: subject.name },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Breadcrumb segments={breadcrumbs} />
          <h1 className="text-xl font-semibold text-gray-800 mt-2">
            {subject.name}
          </h1>
        </div>
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              viewMode === "table"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setViewMode("card")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              viewMode === "card"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Cards
          </button>
        </div>
      </div>

      {viewMode === "table" ? (
        <DataTable<Book>
          fetchFn={fetchBooks}
          columns={columns}
          searchPlaceholder="Search books..."
          defaultSortBy="created_at"
          defaultSortOrder="asc"
          onRowClick={(book) => navigate(`/self-study/books/${book.id}`)}
          rowKey={(book) => book.id}
        />
      ) : books.length === 0 ? (
        <EmptyState
          icon={<span>📖</span>}
          title="No books available"
          description="Your tutor hasn't assigned any books in this subject yet."
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {books.map((book) => (
            <BookCard
              key={book.id}
              title={book.title}
              standard={book.standard}
              thumbnailUrl={assetUrl(book.thumbnail_url)}
              questionCount={book.question_count}
              onClick={() => navigate(`/self-study/books/${book.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
