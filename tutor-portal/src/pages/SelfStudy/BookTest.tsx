import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LoadingSpinner, EmptyState, Toast, useToast, ConfirmDialog, Breadcrumb, DataTable } from "@shared";
import api from "../../api/client";

interface Book {
  id: string;
  title: string;
  subject_id: string;
}

interface BookTest {
  id: string;
  book_id: string;
  drive_link: string;
  instructions?: string;
  created_at: string;
  updated_at?: string;
}

interface TestSubmission {
  id: string;
  test_id: string;
  student_id: string;
  student_name: string;
  student_login_id: string;
  submitted_at?: string;
  created_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function BookTest() {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast, showApiError, showSuccess } = useToast();

  const [book, setBook] = useState<Book | null>(null);
  const [test, setTest] = useState<BookTest | null>(null);
  const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [driveLink, setDriveLink] = useState("");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalSubmissions, setTotalSubmissions] = useState(0);

  // Fetch book and test data
  const fetchData = useCallback(async () => {
    if (!bookId) return;

    try {
      setLoading(true);
      const [bookRes, testRes] = await Promise.all([
        api.get<Book>(`/books/${bookId}`),
        api.get<BookTest | null>(`/books/${bookId}/test`),
      ]);

      setBook(bookRes.data);
      if (testRes.data) {
        setTest(testRes.data);
        setDriveLink(testRes.data.drive_link);
        setInstructions(testRes.data.instructions || "");
      }
    } catch (err) {
      showApiError(err);
    } finally {
      setLoading(false);
    }
  }, [bookId, showApiError]);

  // Fetch submissions
  const fetchSubmissions = useCallback(async () => {
    if (!bookId) return;

    try {
      setSubmissionsLoading(true);
      const res = await api.get<PaginatedResponse<TestSubmission>>(
        `/books/${bookId}/test/submissions`,
        { params: { page, page_size: pageSize } }
      );
      setSubmissions(res.data.items);
      setTotalSubmissions(res.data.total);
    } catch (err) {
      showApiError(err);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [bookId, page, pageSize, showApiError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (test) {
      fetchSubmissions();
    }
  }, [test, fetchSubmissions]);

  const handleSaveTest = useCallback(async () => {
    if (!bookId || !driveLink.trim()) {
      showApiError(new Error("Drive link is required"));
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post<BookTest>(`/books/${bookId}/test`, {
        drive_link: driveLink.trim(),
        instructions: instructions.trim() || null,
      });
      setTest(res.data);
      showSuccess("Test saved successfully");
    } catch (err) {
      showApiError(err);
    } finally {
      setSubmitting(false);
    }
  }, [bookId, driveLink, instructions, showApiError, showSuccess]);

  const handleDelete = useCallback(async () => {
    if (!bookId) return;

    try {
      setDeleting(true);
      await api.delete(`/books/${bookId}/test`);
      setTest(null);
      setDriveLink("");
      setInstructions("");
      setSubmissions([]);
      showSuccess("Test deleted successfully");
      setShowDeleteConfirm(false);
    } catch (err) {
      showApiError(err);
    } finally {
      setDeleting(false);
    }
  }, [bookId, showApiError, showSuccess]);

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
      {toast && <Toast {...toast} />}

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Self-Study", href: "/self-study" },
          { label: book.title, href: `/self-study/books/${bookId}/preview` },
          { label: "Manage Test", href: "#" },
        ]}
      />

      {/* Header */}
      <div className="mt-6 mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Manage Test</h1>
        {test && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? "Deleting..." : "Delete Test"}
          </button>
        )}
      </div>

      {/* Test Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Details</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Drive Link *
            </label>
            <input
              type="url"
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Provide the full Google Drive link to the test file (embed or view URL)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instructions (Optional)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Any instructions for students..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <button
            onClick={handleSaveTest}
            disabled={submitting || !driveLink.trim()}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving..." : "Save Test"}
          </button>
        </div>
      </div>

      {/* Submissions Table */}
      {test && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Student Submissions ({totalSubmissions})
            </h2>
          </div>

          {submissionsLoading ? (
            <div className="p-6">
              <LoadingSpinner />
            </div>
          ) : submissions.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="📋"
                title="No submissions yet"
                description="Students haven't submitted yet."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Login ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Submitted At
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {submissions.map((submission) => (
                    <tr key={submission.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {submission.student_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {submission.student_login_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {submission.submitted_at ? (
                          <span className="flex items-center gap-2 text-green-700">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            {new Date(submission.submitted_at).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-500">Not submitted</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalSubmissions > pageSize && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {Math.ceil(totalSubmissions / pageSize)}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil(totalSubmissions / pageSize)}
                    className="px-3 py-1 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Test"
          message="Are you sure you want to delete this test? This action cannot be undone."
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          confirmText="Delete"
          cancelText="Cancel"
        />
      )}
    </div>
  );
}
