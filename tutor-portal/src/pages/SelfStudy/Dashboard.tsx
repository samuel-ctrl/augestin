import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SubjectTile, EmptyState, LoadingSpinner, ConfirmDialog, Toast, useToast, extractErrorMessage } from "@shared";
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
    } catch (err) {
      const msg = extractErrorMessage(err, "Failed to load subjects. Please try again.");
      setError(msg);
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
        variant="error"
        icon={
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        }
        title="Unable to load subjects"
        description={error}
        action={{ label: "Try Again", onClick: () => { setLoading(true); fetchSubjects(); } }}
      />
    );
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Self-Study</h1>
          <p className="text-sm text-gray-500 mt-1">
            {subjects.length > 0
              ? `${subjects.length} subject${subjects.length !== 1 ? "s" : ""}`
              : "Manage your study subjects and books"}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Subject
        </button>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
          title="No subjects yet"
          description="Create your first subject to start organizing your study content for students."
          action={{ label: "Create Subject", onClick: () => setShowCreateForm(true) }}
        />
      ) : (
        <div className="flex flex-wrap gap-8">
          {subjects.map((subject, index) => (
            <SubjectTile
              key={subject.id}
              name={subject.name}
              icon={subject.icon}
              bookCount={subject.book_count}
              colorIndex={index}
              onClick={() => navigate(`/self-study/subjects/${subject.id}`)}
              actions={
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditTarget(subject)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="Edit subject"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(subject)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete subject"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
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
