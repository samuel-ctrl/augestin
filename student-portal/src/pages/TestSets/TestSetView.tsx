import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LoadingSpinner, EmptyState, Toast, useToast, PageHeader, Button } from "@shared";
import type { TestSetFile } from "@shared";
import api from "../../api/client";

interface TestSetDetail {
  id: string;
  name: string;
  description?: string;
  files: TestSetFile[];
}

export default function TestSetView() {
  const { id: testSetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [testSet, setTestSet] = useState<TestSetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submissionLink, setSubmissionLink] = useState("");
  const [savedLink, setSavedLink] = useState("");
  const [toggling, setToggling] = useState(false);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [tsRes, subRes] = await Promise.all([
        api.get(`/test-sets/${testSetId}`),
        api.get(`/test-sets/${testSetId}/my-submission`),
      ]);

      setTestSet(tsRes.data);
      setSubmitted(subRes.data.has_submitted);
      if (subRes.data.submission_link) {
        setSubmissionLink(subRes.data.submission_link);
        setSavedLink(subRes.data.submission_link);
      }
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
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Files ({testSet.files.length})
        </h2>

        {testSet.files.length === 0 ? (
          <p className="text-sm text-gray-500">No files available yet.</p>
        ) : (
          <div className="space-y-3">
            {testSet.files.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900">{file.file_name}</h3>
                  {file.instructions && (
                    <p className="text-xs text-gray-500 mt-0.5">{file.instructions}</p>
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Submission</h2>
        <p className="text-sm text-gray-600 mb-4">
          Submit your completed test by pasting a Google Drive link or PDF link below, then mark as submitted.
        </p>

        {/* Link Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
    </div>
  );
}
