import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  LoadingSpinner,
  Toast,
  extractErrorMessage,
  useToast,
} from "@shared";
import api from "../../api/client";

interface TestSetInfo {
  id: string;
  name: string;
}

interface AssignedStudent {
  student_id: string;
  student_name: string;
  student_login_id: string;
}

interface LeaderboardEntry {
  id: string | null; // null for unsaved rows
  student_id: string;
  student_name: string;
  student_login_id: string;
  rank: number;
  score: string;
  notes: string | null;
}

function scoreNumeric(score: string): number {
  // Accept "70/80", "70", "70%" — use the numerator or full number
  const match = score.match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

export default function TestSetLeaderboard() {
  const { id: testSetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [testSet, setTestSet] = useState<TestSetInfo | null>(null);
  const [assigned, setAssigned] = useState<AssignedStudent[]>([]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState<null | (() => void)>(null);
  const { toast, showSuccess, showApiError, dismiss } = useToast();

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const fetchAllAssignments = async (): Promise<AssignedStudent[]> => {
        const pageSize = 100;
        const all: AssignedStudent[] = [];
        let page = 1;
        while (true) {
          const res = await api.get(`/test-sets/${testSetId}/assignments`, {
            params: { page, page_size: pageSize },
          });
          const items = (res.data.items as AssignedStudent[]) ?? [];
          all.push(...items);
          const totalPages = res.data.total_pages ?? 1;
          if (page >= totalPages || items.length === 0) break;
          page += 1;
        }
        return all;
      };

      const [tsRes, assignItems, lbRes] = await Promise.all([
        api.get<TestSetInfo>(`/test-sets/${testSetId}`),
        fetchAllAssignments(),
        api.get<LeaderboardEntry[]>(`/test-sets/${testSetId}/leaderboard`),
      ]);
      setTestSet(tsRes.data);
      setAssigned(assignItems);
      setEntries(lbRes.data.map((e) => ({ ...e })));
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        navigate("/test-sets");
      } else {
        setError(extractErrorMessage(err, "Failed to load leaderboard."));
      }
    } finally {
      setLoading(false);
    }
  }, [testSetId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markDirty = () => setDirty(true);

  const availableStudents = (currentStudentId: string) => {
    const taken = new Set(
      entries
        .map((e) => e.student_id)
        .filter((sid) => sid && sid !== currentStudentId)
    );
    return assigned.filter((s) => !taken.has(s.student_id));
  };

  const addRow = () => {
    const nextRank = entries.length
      ? Math.max(...entries.map((e) => e.rank)) + 1
      : 1;
    setEntries((prev) => [
      ...prev,
      {
        id: null,
        student_id: "",
        student_name: "",
        student_login_id: "",
        rank: nextRank,
        score: "",
        notes: "",
      },
    ]);
    markDirty();
  };

  const updateRow = (idx: number, patch: Partial<LeaderboardEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
    markDirty();
  };

  const removeRow = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
    markDirty();
  };

  const autoSortByScore = () => {
    const withStudent = entries.filter((e) => e.student_id);
    const withoutStudent = entries.filter((e) => !e.student_id);
    const sorted = [...withStudent].sort(
      (a, b) => scoreNumeric(b.score) - scoreNumeric(a.score)
    );
    const ranked = sorted.map((e, i) => ({ ...e, rank: i + 1 }));
    // Keep empty rows at the bottom so admin doesn't lose them
    setEntries([...ranked, ...withoutStudent]);
    markDirty();
  };

  const handleSave = async () => {
    // Validate
    const invalid = entries.find(
      (e) => !e.student_id || !e.score.trim() || e.rank < 1
    );
    if (invalid) {
      showApiError(null, "Every row needs a student, a score, and rank ≥ 1.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        entries: entries.map((e) => ({
          student_id: e.student_id,
          rank: e.rank,
          score: e.score.trim(),
          notes: e.notes || null,
        })),
      };
      const res = await api.put<LeaderboardEntry[]>(
        `/test-sets/${testSetId}/leaderboard`,
        payload
      );
      setEntries(res.data.map((e) => ({ ...e })));
      setDirty(false);
      showSuccess("Leaderboard saved.");
    } catch (err) {
      showApiError(err, "Failed to save leaderboard.");
    } finally {
      setSaving(false);
    }
  };

  const guardedNavigate = (to: string) => {
    if (dirty) {
      setConfirmLeave(() => () => navigate(to));
    } else {
      navigate(to);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{
          label: "Try Again",
          onClick: () => {
            setLoading(true);
            fetchData();
          },
        }}
      />
    );
  }
  if (!testSet) return null;

  return (
    <div className="max-w-4xl">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      <button
        onClick={() => guardedNavigate("/test-sets")}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Test Sets
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Leaderboard</h1>
          <p className="text-sm text-gray-500">{testSet.name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" color="secondary" onClick={autoSortByScore}>
            Auto-sort by score
          </Button>
          <Button size="sm" variant="outline" color="primary" onClick={addRow}>
            + Add Student
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<span>🏆</span>}
          title="No leaderboard entries yet"
          description={
            assigned.length === 0
              ? "Assign students to this test set first."
              : "Click “+ Add Student” to add a row."
          }
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-20">Rank</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Student</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-32">Score</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Notes</th>
                <th className="px-4 py-2 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map((entry, idx) => {
                const options = availableStudents(entry.student_id);
                const rowKey = entry.id || entry.student_id || `new-${idx}`;
                return (
                  <tr key={rowKey}>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={1}
                        value={entry.rank}
                        onChange={(e) =>
                          updateRow(idx, { rank: parseInt(e.target.value, 10) || 1 })
                        }
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={entry.student_id}
                        onChange={(e) => {
                          const sid = e.target.value;
                          const s = assigned.find((a) => a.student_id === sid);
                          updateRow(idx, {
                            student_id: sid,
                            student_name: s?.student_name || "",
                            student_login_id: s?.student_login_id || "",
                          });
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select student…</option>
                        {entry.student_id && (
                          <option value={entry.student_id}>
                            {entry.student_name} ({entry.student_login_id})
                          </option>
                        )}
                        {options.map((s) => (
                          <option key={s.student_id} value={s.student_id}>
                            {s.student_name} ({s.student_login_id})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={entry.score}
                        onChange={(e) => updateRow(idx, { score: e.target.value })}
                        placeholder="e.g. 70/80"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={entry.notes || ""}
                        onChange={(e) => updateRow(idx, { notes: e.target.value })}
                        placeholder="(optional)"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-red-500 hover:text-red-700 text-lg"
                        title="Remove row"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <Button
          variant="outline"
          color="secondary"
          onClick={() => guardedNavigate("/test-sets")}
        >
          Cancel
        </Button>
        <Button color="primary" onClick={handleSave} loading={saving} disabled={!dirty}>
          Save All
        </Button>
      </div>

      <ConfirmDialog
        open={!!confirmLeave}
        title="Unsaved changes"
        alertMessage="Any unsaved leaderboard edits will be lost."
        message="Leave without saving?"
        confirmLabel="Leave"
        variant="danger"
        onConfirm={() => {
          const fn = confirmLeave;
          setConfirmLeave(null);
          if (fn) fn();
        }}
        onCancel={() => setConfirmLeave(null)}
      />
    </div>
  );
}
