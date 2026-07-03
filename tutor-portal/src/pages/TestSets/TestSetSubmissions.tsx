import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { LoadingSpinner, EmptyState, Toast, useToast, extractErrorMessage, Button } from "@shared";
import api from "../../api/client";

interface TestSetInfo {
  id: string;
  name: string;
}

interface SubmissionItem {
  id: string;
  test_set_id: string;
  student_id: string;
  student_name: string;
  student_login_id: string;
  submitted_at: string | null;
  submission_link: string | null;
  created_at: string;
}

export default function TestSetSubmissions() {
  const { id: testSetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [testSet, setTestSet] = useState<TestSetInfo | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const { toast, showApiError, dismiss } = useToast();

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [tsRes, subRes] = await Promise.all([
        api.get(`/test-sets/${testSetId}`),
        api.get(`/test-sets/${testSetId}/submissions`, {
          params: { page, page_size: pageSize },
        }),
      ]);
      setTestSet(tsRes.data);
      setSubmissions(subRes.data.items);
      setTotal(subRes.data.total);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        navigate("/test-sets");
      } else {
        setError(extractErrorMessage(err, "Failed to load submissions."));
      }
    } finally {
      setLoading(false);
    }
  }, [testSetId, page, pageSize, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="w-6 h-6" />}
        variant="error"
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => { setLoading(true); fetchData(); } }}
      />
    );
  }
  if (!testSet) return null;

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      <button
        onClick={() => navigate("/test-sets")}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Test Sets
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Submissions</h1>
          <p className="text-sm text-gray-500">{testSet.name} ({total} students)</p>
        </div>
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-6 h-6" />}
          title="No submissions yet"
          description="Assign students to this test set first."
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Login ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Submission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.student_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{sub.student_login_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {sub.submitted_at ? (
                        <span className="flex items-center gap-2 text-green-700">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          {new Date(sub.submitted_at).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-500">Not submitted</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {sub.submission_link ? (
                        <a
                          href={sub.submission_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
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
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
