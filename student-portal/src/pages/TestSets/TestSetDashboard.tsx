import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner, EmptyState, Toast, useToast, extractErrorMessage, PageHeader } from "@shared";
import type { AssignedTestSet } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";

export default function TestSetDashboard() {
  const navigate = useNavigate();
  const [testSets, setTestSets] = useState<AssignedTestSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast, dismiss } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/students/test-sets");
        setTestSets(res.data.items || res.data);
      } catch (err: unknown) {
        setError(extractErrorMessage(err, "Failed to load test sets."));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => window.location.reload() }}
      />
    );
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title="Test Sets"
        subtitle="Tests assigned to you"
      />

      {testSets.length === 0 ? (
        <EmptyState
          icon={<span>📝</span>}
          title="No test sets assigned yet"
          description="Check back later for new test sets."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testSets.map((ts) => {
            const submitted = ts.submission_status?.has_submitted;
            return (
              <button
                key={ts.id}
                onClick={() => navigate(`/test-sets/${ts.id}`)}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg hover:border-primary-300 transition-all text-left"
              >
                {ts.thumbnail_url && (
                  <div className="mb-3 h-32 bg-gray-200 rounded overflow-hidden">
                    <img
                      src={assetUrl(ts.thumbnail_url)}
                      alt={ts.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.parentElement!.style.display = "none"; }}
                    />
                  </div>
                )}
                <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                  {ts.name}
                </h3>
                {ts.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{ts.description}</p>}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">
                    {ts.file_count} file{ts.file_count !== 1 ? "s" : ""}
                  </span>
                  {submitted && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      Submitted
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
