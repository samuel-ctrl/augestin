import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SubjectCard, EmptyState, LoadingSpinner, extractErrorMessage } from "@shared";
import type { Subject } from "@shared";
import api from "../../api/client";

export default function Dashboard() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const subjectsRes = await api.get("/subjects", {
        params: { page: 1, page_size: 100, sort_by: "name", sort_order: "asc" },
      });
      setSubjects(subjectsRes.data.items);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to load subjects. Please try again."));
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
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => { setLoading(true); fetchData(); } }}
      />
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">Self-Study</h1>

      {/* Subject Grid */}
      {subjects.length === 0 ? (
        <EmptyState
          icon={<span>!</span>}
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
