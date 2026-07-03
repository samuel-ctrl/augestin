import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Inbox } from "lucide-react";
import { SubjectTile, EmptyState, LoadingSpinner, extractErrorMessage, PageHeader } from "@shared";
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
        icon={<AlertTriangle className="w-6 h-6" />}
        variant="error"
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => { setLoading(true); fetchData(); } }}
      />
    );
  }

  return (
    <div>
      <PageHeader title="Learn Zone" subtitle="Select a subject to start learning" />

      {/* Subject Grid */}
      {subjects.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-6 h-6" />}
          title="No subjects assigned yet"
          description="Please contact your tutor to get started."
        />
      ) : (
        <div>
          <div className="flex flex-wrap gap-4 sm:gap-6 md:gap-8">
            {subjects.map((subject, index) => (
              <SubjectTile
                key={subject.id}
                name={subject.name}
                icon={subject.icon}
                bookCount={subject.book_count}
                colorIndex={index}
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
