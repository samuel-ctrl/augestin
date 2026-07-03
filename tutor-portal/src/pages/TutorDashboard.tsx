import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, BookOpen, Library, Puzzle, BarChart3, CheckCircle2, Trophy, TrendingUp } from "lucide-react";
import { LoadingSpinner, PageHeader } from "@shared";
import api from "../api/client";

interface DashboardStats {
  students: number;
  subjects: number;
  books: number;
  quizSets: number;
  avgQuizScore: number;
  assignmentCompletionRate: number;
  topPerformers: number;
  quizCompletionRate: number;
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
  suffix,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all text-left w-full"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
            {value}{suffix && <span className="text-lg font-semibold text-gray-500">{suffix}</span>}
          </p>
        </div>
        <div className="w-12 h-12 rounded-lg bg-primary-50 text-primary-500 flex items-center justify-center text-xl">
          {icon}
        </div>
      </div>
    </Component>
  );
}

export default function TutorDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    students: 0,
    subjects: 0,
    books: 0,
    quizSets: 0,
    avgQuizScore: 0,
    assignmentCompletionRate: 0,
    topPerformers: 0,
    quizCompletionRate: 0,
  });
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [studentsRes, subjectsRes, quizSetsRes, dashRes] = await Promise.all([
          api.get("/students", { params: { page: 1, page_size: 5, sort_by: "created_at", sort_order: "desc" } }),
          api.get("/subjects", { params: { page: 1, page_size: 100 } }),
          api.get("/quiz-sets", { params: { page: 1, page_size: 1 } }),
          api.get("/dashboard/stats").catch(() => ({ data: {} })),
        ]);

        const subjects = subjectsRes.data.items;
        const totalBooks = subjects.reduce(
          (sum: number, s: { book_count: number }) => sum + (s.book_count || 0),
          0
        );
        const d = dashRes.data;

        setStats({
          students: studentsRes.data.total,
          subjects: subjects.length,
          books: totalBooks,
          quizSets: quizSetsRes.data.total,
          avgQuizScore: d.avg_quiz_score ?? 0,
          assignmentCompletionRate: d.assignment_completion_rate ?? 0,
          topPerformers: d.top_performers ?? 0,
          quizCompletionRate: d.quiz_completion_rate ?? 0,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Students"
          value={stats.students}
          icon={<Users className="w-6 h-6" />}
          onClick={() => navigate("/students")}
        />
        <StatCard
          label="Subjects"
          value={stats.subjects}
          icon={<BookOpen className="w-6 h-6" />}
          onClick={() => navigate("/self-study")}
        />
        <StatCard
          label="Books"
          value={stats.books}
          icon={<Library className="w-6 h-6" />}
          onClick={() => navigate("/self-study")}
        />
        <StatCard
          label="Quiz Sets"
          value={stats.quizSets}
          icon={<Puzzle className="w-6 h-6" />}
          onClick={() => navigate("/quiz-sets")}
        />
      </div>

      {/* Performance Overview */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Performance Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Avg Quiz Score"
          value={stats.avgQuizScore}
          suffix="%"
          icon={<BarChart3 className="w-6 h-6" />}
        />
        <StatCard
          label="Assignment Completion"
          value={stats.assignmentCompletionRate}
          suffix="%"
          icon={<CheckCircle2 className="w-6 h-6" />}
        />
        <StatCard
          label="Top Performers"
          value={stats.topPerformers}
          icon={<Trophy className="w-6 h-6" />}
        />
        <StatCard
          label="Quiz Completion Rate"
          value={stats.quizCompletionRate}
          suffix="%"
          icon={<TrendingUp className="w-6 h-6" />}
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