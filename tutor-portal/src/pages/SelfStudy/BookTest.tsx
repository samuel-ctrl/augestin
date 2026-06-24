import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LoadingSpinner, EmptyState, Toast, useToast, ConfirmDialog, Breadcrumb, Button } from "@shared";
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
  submission_link?: string;
  created_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Validate Google Drive URL
function isValidDriveUrl(url: string): boolean {
  if (!url.trim()) return false;
  return url.includes("drive.google.com") && (
    url.includes("/file/") || url.includes("/folders/")
  );
}

export default function BookTestPage() {
  const { id: bookId } = useParams<{ id: string }>();
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const [urlError, setUrlError] = useState<string | null>(null);

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
  const [pageSize] = useState(50);
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
      showApiError(err, "Failed to load test data.");
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
      showApiError(err, "Failed to load submissions.");
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
      setUrlError("Drive link is required");
      return;
    }

    if (!isValidDriveUrl(driveLink)) {
      setUrlError("Please provide a valid Google Drive URL (must contain drive.google.com and /file/ or /folders/)");
      return;
    }

    setUrlError(null);

    try {
      setSubmitting(true);
      const res = await api.post<BookTest>(`/books/${bookId}/test`, {
        drive_link: driveLink.trim(),
        instructions: instructions.trim() || null,
      });
      setTest(res.data);
      showSuccess("Test saved successfully");
    } catch (err) {
      showApiError(err, "Failed to save test.");
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
      showApiError(err, "Failed to delete test.");
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
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {/* Breadcrumb */}
      <Breadcrumb
        segments={[
          { label: "Learn Zone", path: "/self-study" },
          { label: book.title, path: `/self-study/books/${bookId}/preview` },
          { label: "Manage Test" },
        ]}
      />

      {/* Header */}
      <div className="mt-6 mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Manage Test</h1>
        {test && (
          <Button color="danger" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete Test"}
          </Button>
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
              onChange={(e) => {
                setDriveLink(e.target.value);
                setUrlError(null);
              }}
              placeholder="https://drive.google.com/file/d/..."
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                urlError
                  ? "border-red-300 focus:ring-red-500 bg-red-50"
                  : "border-gray-300 focus:ring-primary-500"
              }`}
            />
            {urlError ? (
              <p className="text-xs text-red-600 mt-1">{urlError}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Provide the full Google Drive link to the test file (embed or view URL)
              </p>
            )}
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

          <Button color="primary" onClick={handleSaveTest} disabled={submitting || !driveLink.trim()}>
            {submitting ? "Saving..." : "Save Test"}
          </Button>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Submission
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {submission.submission_link ? (
                          <a
                            href={submission.submission_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:underline"
                          >
                            View file
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
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
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Test"
        alertMessage="This action cannot be undone."
        message="Are you sure you want to delete this test?"
        variant="danger"
        countdownSeconds={5}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
}
