import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SubjectCard, EmptyState, LoadingSpinner, ConfirmDialog, Toast, useToast } from "@shared";
import type { Subject } from "@shared";
import api from "../../api/client";
import SubjectForm from "../../components/SubjectForm";

export default function Dashboard() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchSubjects = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get("/subjects", {
        params: { page: 1, page_size: 100, sort_by: "name", sort_order: "asc" },
      });
      setSubjects(res.data.items);
    } catch {
      setError("Failed to load subjects. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleCreate = async (data: { name: string; icon: string }) => {
    setFormLoading(true);
    try {
      await api.post("/subjects", data);
      setShowCreateForm(false);
      showSuccess("Subject created successfully.");
      fetchSubjects();
    } catch (err) {
      showApiError(err, "Failed to create subject. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (data: { name: string; icon: string }) => {
    if (!editTarget) return;
    setFormLoading(true);
    try {
      await api.put(`/subjects/${editTarget.id}`, data);
      setEditTarget(null);
      showSuccess("Subject updated successfully.");
      fetchSubjects();
    } catch (err) {
      showApiError(err, "Failed to update subject. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/subjects/${deleteTarget.id}`);
      showSuccess(`Subject "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      fetchSubjects();
    } catch (err) {
      setDeleteTarget(null);
      showApiError(err, "Failed to delete subject. Please try again.");
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => { setLoading(true); fetchSubjects(); } }}
      />
    );
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Self-Study</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Add Subject
        </button>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon={<span>Books</span>}
          title="No subjects yet"
          description="Create your first subject to start organizing content."
          action={{ label: "Create Subject", onClick: () => setShowCreateForm(true) }}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {subjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              name={subject.name}
              icon={subject.icon}
              bookCount={subject.book_count}
              onClick={() => navigate(`/self-study/subjects/${subject.id}`)}
              actions={
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditTarget(subject)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(subject)}
                    className="text-xs text-red-400 hover:text-red-600 px-1"
                  >
                    Delete
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}

      <SubjectForm
        open={showCreateForm}
        title="Create Subject"
        onSubmit={handleCreate}
        onCancel={() => setShowCreateForm(false)}
        loading={formLoading}
      />

      <SubjectForm
        open={!!editTarget}
        title="Edit Subject"
        initialName={editTarget?.name}
        initialIcon={editTarget?.icon}
        onSubmit={handleEdit}
        onCancel={() => setEditTarget(null)}
        loading={formLoading}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Subject"
        message={`Delete "${deleteTarget?.name}"? All books, assignments, and progress under this subject will be permanently removed.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
