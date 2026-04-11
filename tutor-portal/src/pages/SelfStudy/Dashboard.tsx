import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SubjectTile, EmptyState, LoadingSpinner, ConfirmDialog, Toast, useToast, extractErrorMessage, Button, PageHeader } from "@shared";
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
  const [deleting, setDeleting] = useState(false);
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
    setDeleting(true);
    try {
      await api.delete(`/subjects/${deleteTarget.id}`);
      showSuccess(`Subject "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      fetchSubjects();
    } catch (err) {
      showApiError(err, "Failed to delete subject. Please try again.");
    } finally {
      setDeleting(false);
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

      <PageHeader
        title="Learn Zone"
        subtitle={
          subjects.length > 0
            ? `${subjects.length} subject${subjects.length !== 1 ? "s" : ""}`
            : "Manage your study subjects and books"
        }
        actions={
          <Button color="success" onClick={() => setShowCreateForm(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Subject
          </Button>
        }
      />

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
        <div className="flex flex-wrap gap-4 sm:gap-6 md:gap-8">
          {subjects.map((subject, index) => (
            <SubjectTile
              key={subject.id}
              name={subject.name}
              icon={subject.icon}
              bookCount={subject.book_count}
              colorIndex={index}
              onClick={() => navigate(`/self-study/subjects/${subject.id}`)}
              menuItems={[
                { label: "Edit", onClick: () => setEditTarget(subject) },
                { label: "Delete", onClick: () => setDeleteTarget(subject), variant: "danger" },
              ]}
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
        alertMessage="All books, assignments, and progress under this subject will be permanently removed."
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        variant="danger"
        countdownSeconds={5}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
