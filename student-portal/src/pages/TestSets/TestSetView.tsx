import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LoadingSpinner, EmptyState, Toast, useToast, PageHeader, Button } from "@shared";
import type { TestSetFile } from "@shared";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";

interface TestSetDetail {
  id: string;
  name: string;
  description?: string;
  files: TestSetFile[];
}

interface LeaderboardEntry {
  id: string;
  student_id: string;
  student_name: string;
  student_login_id: string;
  rank: number;
  score: string;
  notes: string | null;
}

export default function TestSetView() {
  const { id: testSetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [testSet, setTestSet] = useState<TestSetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submissionLink, setSubmissionLink] = useState("");
  const [savedLink, setSavedLink] = useState("");
  const [toggling, setToggling] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [tsRes, subRes, lbRes] = await Promise.all([
        api.get(`/test-sets/${testSetId}`),
        api.get(`/test-sets/${testSetId}/my-submission`),
        api.get<LeaderboardEntry[]>(`/students/test-sets/${testSetId}/leaderboard`)
          .catch(() => ({ data: [] as LeaderboardEntry[] })),
      ]);

      setTestSet(tsRes.data);
      setSubmitted(subRes.data.has_submitted);
      if (subRes.data.submission_link) {
        setSubmissionLink(subRes.data.submission_link);
        setSavedLink(subRes.data.submission_link);
      }
      setLeaderboard(lbRes.data);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403 || status === 404) {
        navigate("/test-sets");
      } else {
        showApiError(err, "Failed to load test set.");
      }
    } finally {
      setLoading(false);
    }
  }, [testSetId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    setToggling(true);
    try {
      const res = await api.put(`/test-sets/${testSetId}/submit`, {
        submission_link: submissionLink.trim() || null,
      });
      setSubmitted(res.data.has_submitted);
      if (res.data.submission_link) {
        setSavedLink(res.data.submission_link);
      }
      if (res.data.has_submitted) {
        showSuccess("Test submitted successfully!");
      }
    } catch (err) {
      showApiError(err, "Failed to update submission.");
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (!testSet) return null;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title={testSet.name}
        subtitle={testSet.description}
        backButton={{ label: "Test Sets", onClick: () => navigate("/test-sets") }}
      />

      {/* Files */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Files ({testSet.files.length})
        </h2>

        {testSet.files.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No files available yet.</p>
        ) : (
          <div className="space-y-3">
            {testSet.files.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-50">{file.file_name}</h3>
                  {file.instructions && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{file.instructions}</p>
                  )}
                </div>
                <a
                  href={file.drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 px-4 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors shrink-0"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submission */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-3">Submission</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Submit your completed test by pasting a Google Drive link or PDF link below, then mark as submitted.
        </p>

        {/* Link Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Submission Link (Google Drive / PDF)
          </label>
          <input
            type="url"
            value={submissionLink}
            onChange={(e) => setSubmissionLink(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (pasted) {
                e.preventDefault();
                setSubmissionLink(pasted.trim());
              }
            }}
            placeholder="https://drive.google.com/file/d/... or PDF link"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-500"
            disabled={submitted}
          />
          {savedLink && submitted && (
            <a
              href={savedLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 mt-1"
            >
              View submitted link
            </a>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={toggling}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            submitted
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : "bg-primary-600 text-white hover:bg-primary-700"
          }`}
        >
          {toggling
            ? "Updating..."
            : submitted
            ? "Submitted — Click to Undo"
            : "Submit Test"}
        </button>
      </div>

      {leaderboard.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">🏆 Leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-16">Rank</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">Student</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-28">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {leaderboard.map((e) => {
                  const isMe = user && e.student_id === user.id;
                  return (
                    <tr key={e.id} className={isMe ? "bg-amber-50" : ""}>
                      <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-50">{e.rank}</td>
                      <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-100">
                        {e.student_name}
                        {isMe && <span className="ml-2 text-xs text-amber-600">(you)</span>}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">{e.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
