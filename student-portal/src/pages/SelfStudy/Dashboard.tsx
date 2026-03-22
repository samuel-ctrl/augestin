import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SubjectCard, EmptyState, LoadingSpinner, ProgressBar, extractErrorMessage } from "@shared";
import type { Subject, ResumeBook } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";

export default function Dashboard() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [resumeBook, setResumeBook] = useState<ResumeBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [subjectsRes, resumeRes] = await Promise.allSettled([
        api.get("/subjects", {
          params: { page: 1, page_size: 100, sort_by: "name", sort_order: "asc" },
        }),
        api.get("/progress/resume"),
      ]);

      if (subjectsRes.status === "fulfilled") {
        setSubjects(subjectsRes.value.data.items);
      } else {
        setError(extractErrorMessage(subjectsRes.reason, "Failed to load subjects. Please try again."));
      }
      if (resumeRes.status === "fulfilled" && resumeRes.value.data) {
        setResumeBook(resumeRes.value.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
        action={{ label: "Try Again", onClick: () => { setLoading(true); fetchData(); } }}
      />
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">Self-Study</h1>

      {/* Resume Learning */}
      {resumeBook && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            Resume Learning
          </h2>
          <div
            className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4"
            onClick={() => navigate(`/self-study/books/${resumeBook.book_id}`)}
          >
            {resumeBook.thumbnail_url && (
              <img
                src={assetUrl(resumeBook.thumbnail_url)}
                alt={resumeBook.book_title}
                className="w-20 h-14 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-800 truncate">
                {resumeBook.book_title}
              </h3>
              <p className="text-sm text-gray-400">
                {resumeBook.subject_name}
              </p>
              <div className="mt-1 max-w-xs">
                <ProgressBar
                  percentage={resumeBook.watch_percentage}
                  size="sm"
                />
              </div>
            </div>
            <span className="text-primary-600 text-sm font-medium shrink-0">
              Continue →
            </span>
          </div>
        </div>
      )}

      {/* Subject Grid */}
      {subjects.length === 0 ? (
        <EmptyState
          icon={<span>📭</span>}
          title="No subjects assigned yet"
          description="Please contact your tutor to get started."
        />
      ) : (
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            Select a subject to start learning
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {subjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                name={subject.name}
                icon={subject.icon}
                bookCount={subject.book_count}
                onClick={() =>
                  navigate(`/self-study/subjects/${subject.id}`)
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
