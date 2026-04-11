import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { DataTable, LoadingSpinner, ConfirmDialog, EmptyState, Toast, useToast, extractErrorMessage, Button } from "@shared";
import type {
  Student,
  BookProgress,
  ColumnDef,
  PaginatedResponse,
  TableQueryParams,
} from "@shared";
import api from "../../api/client";

const progressColumns: ColumnDef<BookProgress>[] = [
  { key: "book_title", label: "Book" },
  {
    key: "watch_percentage",
    label: "Progress",
    render: (v) => {
      const pct = v as number;
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[120px]">
            <div
              className={`h-2 rounded-full ${pct >= 90 ? "bg-green-500" : "bg-primary-500"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-10 text-right">
            {Math.round(pct)}%
          </span>
        </div>
      );
    },
  },
  {
    key: "completed",
    label: "Status",
    render: (v) =>
      v ? (
        <span className="text-green-600 text-xs font-medium">Completed</span>
      ) : (
        <span className="text-gray-400 text-xs">In Progress</span>
      ),
  },
  {
    key: "last_watched_at",
    label: "Last Watched",
    render: (v) =>
      v ? new Date(v as string).toLocaleDateString() : "\u2014",
  },
];

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");
  const [sendingReminder, setSendingReminder] = useState(false);
  const [perfStats, setPerfStats] = useState<{ avg_score: number; completed_chapters: number; pending_tasks: number } | null>(null);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  useEffect(() => {
    Promise.all([
      api.get(`/students/${id}`),
      api.get(`/students/${id}/progress`, { params: { page: 1, page_size: 200 } }).catch(() => null),
    ])
      .then(([studentRes, progressRes]) => {
        setStudent(studentRes.data);
        // Compute perf stats from progress
        if (progressRes?.data?.items) {
          const items = progressRes.data.items;
          const completed = items.filter((p: any) => p.completed).length;
          const pending = items.filter((p: any) => !p.completed).length;
          const scores = items.filter((p: any) => p.watch_percentage > 0).map((p: any) => p.watch_percentage);
          const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
          setPerfStats({ avg_score: Math.round(avg), completed_chapters: completed, pending_tasks: pending });
        }
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          navigate("/students");
        } else {
          setError(extractErrorMessage(err, "Failed to load student details. Please try again."));
        }
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const fetchProgress = async (
    params: TableQueryParams
  ): Promise<PaginatedResponse<BookProgress>> => {
    const res = await api.get(`/students/${id}/progress`, { params });
    return res.data;
  };

  const handleResetPassword = async () => {
    setResettingPassword(true);
    try {
      const res = await api.post(`/students/${id}/reset-password`);
      setNewPassword(res.data.password);
      setShowResetConfirm(false);
      showSuccess("Password reset successfully.");
    } catch (err) {
      showApiError(err, "Failed to reset password. Please try again.");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSendReminder = async () => {
    if (!reminderMessage.trim()) return;
    setSendingReminder(true);
    try {
      await api.post("/notifications", {
        recipient_id: id,
        message: reminderMessage.trim(),
      });
      showSuccess("Reminder sent successfully!");
      setReminderMessage("");
      setShowReminderForm(false);
    } catch (err) {
      showApiError(err, "Failed to send reminder.");
    } finally {
      setSendingReminder(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Back to Students", onClick: () => navigate("/students") }}
      />
    );
  }
  if (!student) return null;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <button
        onClick={() => navigate("/students")}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Students
      </button>

      {/* Student Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">
              {student.name}
            </h1>
            <div className="mt-2 space-y-1 text-sm text-gray-500">
              <p>Login ID: <span className="font-mono text-gray-700">{student.login_id}</span></p>
              {student.email && <p>Email: {student.email}</p>}
              {student.phone && <p>Phone: {student.phone}</p>}
              {student.standard && <p>Standard: {student.standard}th</p>}
              <p>Assignments: {student.assignment_count}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" color="primary" size="sm" onClick={() => setShowReminderForm(!showReminderForm)}>
              Send Reminder
            </Button>
            <Button variant="outline" color="warning" size="sm" onClick={() => setShowResetConfirm(true)}>
              Reset Password
            </Button>
          </div>
        </div>

        {newPassword && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              New password: <span className="font-mono font-bold">{newPassword}</span>
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              Share this securely. It won't be shown again.
            </p>
          </div>
        )}
      </div>

      {/* Send Reminder Form */}
      {showReminderForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Send Personal Reminder</h3>
          <textarea
            value={reminderMessage}
            onChange={(e) => setReminderMessage(e.target.value)}
            placeholder="Type a reminder message for this student..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
          />
          <div className="flex gap-2">
            <Button size="sm" color="primary" onClick={handleSendReminder} disabled={!reminderMessage.trim()} loading={sendingReminder}>
              Send
            </Button>
            <Button size="sm" variant="outline" color="secondary" onClick={() => setShowReminderForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Performance Overview */}
      {perfStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Avg Progress</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{perfStats.avg_score}<span className="text-sm font-normal text-gray-400">%</span></p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Completed Chapters</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{perfStats.completed_chapters}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Pending Tasks</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{perfStats.pending_tasks}</p>
          </div>
        </div>
      )}

      {/* Progress Table */}
      <h2 className="text-lg font-medium text-gray-800 mb-3">
        Learning Progress
      </h2>
      <DataTable<BookProgress>
        fetchFn={fetchProgress}
        columns={progressColumns}
        defaultSortBy="last_watched_at"
        defaultSortOrder="desc"
        defaultPageSize={20}
        rowKey={(p) => p.book_id}
      />

      <ConfirmDialog
        open={showResetConfirm}
        title="Reset Password"
        alertMessage="The student's current password will stop working immediately."
        message={`Generate a new password for "${student.name}"?`}
        confirmLabel="Reset"
        variant="danger"
        countdownSeconds={5}
        onConfirm={handleResetPassword}
        onCancel={() => setShowResetConfirm(false)}
        loading={resettingPassword}
      />
    </div>
  );
}
