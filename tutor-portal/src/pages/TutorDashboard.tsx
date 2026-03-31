import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner, PageHeader } from "@shared";
import api from "../api/client";

interface DashboardStats {
  students: number;
  subjects: number;
  books: number;
  quizSets: number;
}

interface RecentStudent {
  id: string;
  name: string;
  login_id: string;
  standard?: string;
  created_at: string;
}

function StatCard({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all text-left w-full"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="w-12 h-12 rounded-lg bg-primary-50 text-primary-500 flex items-center justify-center text-xl">
          {icon}
        </div>
      </div>
    </button>
  );
}

export default function TutorDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    students: 0,
    subjects: 0,
    books: 0,
    quizSets: 0,
  });
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [studentsRes, subjectsRes, quizSetsRes] = await Promise.all([
          api.get("/students", { params: { page: 1, page_size: 5, sort_by: "created_at", sort_order: "desc" } }),
          api.get("/subjects", { params: { page: 1, page_size: 100 } }),
          api.get("/quiz-sets", { params: { page: 1, page_size: 1 } }),
        ]);

        const subjects = subjectsRes.data.items;
        const totalBooks = subjects.reduce(
          (sum: number, s: { book_count: number }) => sum + (s.book_count || 0),
          0
        );

        setStats({
          students: studentsRes.data.total,
          subjects: subjects.length,
          books: totalBooks,
          quizSets: quizSetsRes.data.total,
        });
        setRecentStudents(studentsRes.data.items);
      } catch {
        // silently fail — dashboard is non-critical
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your teaching platform"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Students"
          value={stats.students}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0112.714 0l.047.28zm-9.39-9.653a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zm8.25-3.375a2.625 2.625 0 115.25 0 2.625 2.625 0 01-5.25 0z" />
            </svg>
          }
          onClick={() => navigate("/students")}
        />
        <StatCard
          label="Subjects"
          value={stats.subjects}
          icon={<span>📚</span>}
          onClick={() => navigate("/self-study")}
        />
        <StatCard
          label="Books"
          value={stats.books}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
          onClick={() => navigate("/self-study")}
        />
        <StatCard
          label="Quiz Sets"
          value={stats.quizSets}
          icon={<span>🧩</span>}
          onClick={() => navigate("/quiz-sets")}
        />
      </div>

      {/* Recent Students */}
      {recentStudents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Recent Students</h2>
            <button
              onClick={() => navigate("/students")}
              className="text-sm text-primary-500 hover:text-primary-600"
            >
              View all
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {recentStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => navigate(`/students/${student.id}`)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{student.name}</p>
                  <p className="text-xs text-gray-500">{student.login_id}</p>
                </div>
                <div className="text-right">
                  {student.standard && (
                    <span className="text-xs text-gray-500">Std {student.standard}</span>
                  )}
                  <p className="text-xs text-gray-400">
                    {new Date(student.created_at).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}