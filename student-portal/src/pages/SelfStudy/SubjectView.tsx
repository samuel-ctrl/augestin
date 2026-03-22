import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { BookCard, EmptyState, LoadingSpinner, Breadcrumb, extractErrorMessage } from "@shared";
import type { Subject, Book, BreadcrumbSegment } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";

export default function SubjectView() {
  const { id: subjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
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
        setError(extractErrorMessage(err, "Failed to load subject. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }, [subjectId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      <div className="mb-6">
        <Breadcrumb segments={breadcrumbs} />
        <h1 className="text-xl font-semibold text-gray-800 mt-2">
          {subject.name}
        </h1>
      </div>

      {books.length === 0 ? (
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
