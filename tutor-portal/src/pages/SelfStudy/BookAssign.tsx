import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { LoadingSpinner, EmptyState, Toast, useToast, extractErrorMessage, standardOptions } from "@shared";
import type { Book, Student, Assignment } from "@shared";
import api from "../../api/client";

export default function BookAssign() {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [originalAssignedIds, setOriginalAssignedIds] = useState<Set<string>>(new Set());
  const [assignmentMap, setAssignmentMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [standardFilter, setStandardFilter] = useState("");
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [bookRes, studentsRes, assignmentsRes] = await Promise.all([
        api.get(`/books/${bookId}`),
        api.get("/students", {
          params: { page: 1, page_size: 100, sort_by: "name", sort_order: "asc" },
        }),
        api.get(`/assignments/book/${bookId}`, {
          params: { page: 1, page_size: 100 },
        }),
      ]);
      setBook(bookRes.data);
      setStudents(studentsRes.data.items);

      const assigned = new Set<string>();
      const aMap = new Map<string, string>();
      (assignmentsRes.data.items as Assignment[]).forEach((a) => {
        assigned.add(a.student_id);
        aMap.set(a.student_id, a.id);
      });
      setAssignedIds(assigned);
      setOriginalAssignedIds(new Set(assigned));
      setAssignmentMap(aMap);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        navigate("/self-study");
      } else {
        setError(extractErrorMessage(err, "Failed to load assignment data. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }, [bookId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleStudent = (studentId: string) => {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Find newly assigned
      const toAssign = [...assignedIds].filter(
        (id) => !originalAssignedIds.has(id)
      );
      // Find unassigned
      const toUnassign = [...originalAssignedIds].filter(
        (id) => !assignedIds.has(id)
      );

      // Assign new students
      if (toAssign.length > 0) {
        await api.post("/assignments", {
          book_id: bookId,
          student_ids: toAssign,
        });
      }

      // Unassign removed students
      for (const studentId of toUnassign) {
        const assignmentId = assignmentMap.get(studentId);
        if (assignmentId) {
          await api.delete(`/assignments/${assignmentId}`);
        }
      }

      showSuccess("Assignments updated successfully.");
      navigate(`/self-study/subjects/${book?.subject_id}`);
    } catch (err) {
      showApiError(err, "Failed to save assignments. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.login_id.toLowerCase().includes(search.toLowerCase());
    const matchesStandard =
      !standardFilter || s.standard === standardFilter;
    return matchesSearch && matchesStandard;
  });

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
  if (!book) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <button
        onClick={() => navigate(`/self-study/subjects/${book.subject_id}`)}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back
      </button>

      <h1 className="text-xl font-semibold text-gray-800 mb-1">
        Assign Students
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {book.title} (Std: {book.standard})
      </p>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <select
          value={standardFilter}
          onChange={(e) => setStandardFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">All Standards</option>
          {standardOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Student list */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200 mb-6 max-h-[400px] overflow-y-auto">
        {filteredStudents.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            No students found
          </div>
        ) : (
          filteredStudents.map((student) => {
            const isAssigned = assignedIds.has(student.id);
            const matchesBookStandard = student.standard === book.standard;
            return (
              <label
                key={student.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isAssigned}
                  onChange={() => toggleStudent(student.id)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-800">{student.name}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {student.login_id}
                  </span>
                </div>
                {student.standard && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      matchesBookStandard
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    Std {student.standard}
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate(`/self-study/subjects/${book.subject_id}`)}
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Assignments"}
        </button>
      </div>
    </div>
  );
}
