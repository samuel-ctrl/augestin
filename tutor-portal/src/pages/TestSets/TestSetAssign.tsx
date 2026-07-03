import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { LoadingSpinner, EmptyState, Toast, useToast, extractErrorMessage, Button, ConfirmDialog } from "@shared";
import type { Student } from "@shared";
import api from "../../api/client";
import { useLookups } from "../../context/LookupContext";

interface TestSetInfo {
  id: string;
  name: string;
}

export default function TestSetAssign() {
  const { id: testSetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { standards } = useLookups();
  const [testSet, setTestSet] = useState<TestSetInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [originalAssignedIds, setOriginalAssignedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [standardFilter, setStandardFilter] = useState("");
  const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [testSetRes, studentsRes, assignmentsRes] = await Promise.all([
        api.get(`/test-sets/${testSetId}`),
        api.get("/students", {
          params: { page: 1, page_size: 100, sort_by: "name", sort_order: "asc" },
        }),
        api.get(`/test-sets/${testSetId}/assignments`, {
          params: { page: 1, page_size: 100 },
        }),
      ]);
      setTestSet(testSetRes.data);
      setStudents(studentsRes.data.items);

      const assigned = new Set<string>();
      (assignmentsRes.data.items as any[]).forEach((a) => {
        assigned.add(a.student_id);
      });
      setAssignedIds(assigned);
      setOriginalAssignedIds(new Set(assigned));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        navigate("/test-sets");
      } else {
        setError(extractErrorMessage(err, "Failed to load assignment data."));
      }
    } finally {
      setLoading(false);
    }
  }, [testSetId, navigate]);

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

  const handleSaveClick = () => {
    const toUnassign = [...originalAssignedIds].filter((id) => !assignedIds.has(id));
    if (toUnassign.length > 0) {
      setShowUnassignConfirm(true);
    } else {
      handleSave();
    }
  };

  const handleSave = async () => {
    setShowUnassignConfirm(false);
    setSaving(true);
    try {
      const toAssign = [...assignedIds].filter((id) => !originalAssignedIds.has(id));
      const toUnassign = [...originalAssignedIds].filter((id) => !assignedIds.has(id));

      for (const studentId of toAssign) {
        await api.post(`/test-sets/${testSetId}/assignments`, { student_id: studentId });
      }
      for (const studentId of toUnassign) {
        await api.delete(`/test-sets/${testSetId}/assignments/${studentId}`);
      }

      showSuccess("Assignments updated successfully.");
      navigate("/test-sets");
    } catch (err) {
      showApiError(err, "Failed to save assignments.");
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.login_id.toLowerCase().includes(search.toLowerCase());
    const matchesStandard = !standardFilter || s.standard === standardFilter;
    return matchesSearch && matchesStandard;
  });

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

  return (
    <div className="max-w-2xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <button
        onClick={() => navigate("/test-sets")}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back
      </button>

      <h1 className="text-xl font-semibold text-gray-800 mb-1">Assign Students</h1>
      <p className="text-sm text-gray-500 mb-6">{testSet.name}</p>

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
          {standards.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200 mb-6 max-h-[400px] overflow-y-auto">
        {filteredStudents.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">No students found</div>
        ) : (
          filteredStudents.map((student) => {
            const isAssigned = assignedIds.has(student.id);
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
                  <span className="text-xs text-gray-400 ml-2">{student.login_id}</span>
                </div>
                {student.standard && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                    Std {student.standard}
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" color="secondary" onClick={() => navigate("/test-sets")}>
          Cancel
        </Button>
        <Button color="primary" onClick={handleSaveClick} loading={saving}>
          Save Assignments
        </Button>
      </div>

      <ConfirmDialog
        open={showUnassignConfirm}
        title="Unassign Students"
        alertMessage="This will remove student access to this test set. Any in-progress work may be lost."
        message={`Are you sure you want to unassign ${[...originalAssignedIds].filter((id) => !assignedIds.has(id)).length} student(s) from this test set?`}
        confirmLabel="Unassign"
        variant="danger"
        countdownSeconds={5}
        onConfirm={handleSave}
        onCancel={() => setShowUnassignConfirm(false)}
      />
    </div>
  );
}
