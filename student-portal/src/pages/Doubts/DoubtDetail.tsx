import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LoadingSpinner, Toast, useToast, ConfirmDialog, Button, AttachmentGallery,
} from "@shared";
import { useAuth } from "../../context/AuthContext";
import type { DoubtDetail as DoubtDetailType, DoubtComment } from "@shared";
import api from "../../api/client";

const statusColors: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};

export default function DoubtDetail() {
  const { id: doubtId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [doubt, setDoubt] = useState<DoubtDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DoubtComment | null>(null);
  const [showDeleteDoubt, setShowDeleteDoubt] = useState(false);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  // Doubt edit state
  const [editingDoubt, setEditingDoubt] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLinks, setEditLinks] = useState<string[]>([]);
  const [savingDoubt, setSavingDoubt] = useState(false);

  const fetchDoubt = useCallback(async () => {
    try {
      const res = await api.get(`/doubts/${doubtId}`);
      setDoubt(res.data);
    } catch (err) {
      showApiError(err, "Failed to load doubt.");
      navigate("/doubts");
    } finally {
      setLoading(false);
    }
  }, [doubtId, navigate]);

  useEffect(() => {
    fetchDoubt();
  }, [fetchDoubt]);

  const startEditingDoubt = () => {
    if (!doubt) return;
    setEditTitle(doubt.title);
    setEditDescription(doubt.description);
    setEditLinks(doubt.attachment_links && doubt.attachment_links.length > 0 ? [...doubt.attachment_links] : [""]);
    setEditingDoubt(true);
  };

  const handleSaveDoubt = async () => {
    if (!editTitle.trim()) {
      showApiError(null, "Title is required");
      return;
    }
    if (!editDescription.trim()) {
      showApiError(null, "Description is required");
      return;
    }
    setSavingDoubt(true);
    try {
      const filteredLinks = editLinks.map(l => l.trim()).filter(Boolean);
      await api.put(`/doubts/${doubtId}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        attachment_links: filteredLinks,
      });
      setEditingDoubt(false);
      showSuccess("Doubt updated");
      fetchDoubt();
    } catch (err) {
      showApiError(err, "Failed to update doubt.");
    } finally {
      setSavingDoubt(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/doubts/${doubtId}/comments`, { content: newComment.trim() });
      setNewComment("");
      showSuccess("Comment added");
      fetchDoubt();
    } catch (err) {
      showApiError(err, "Failed to add comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim()) return;
    try {
      await api.put(`/doubts/${doubtId}/comments/${commentId}`, { content: editContent.trim() });
      setEditingComment(null);
      showSuccess("Comment updated");
      fetchDoubt();
    } catch (err) {
      showApiError(err, "Failed to update comment.");
    }
  };

  const handleDeleteComment = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/doubts/${doubtId}/comments/${deleteTarget.id}`);
      setDeleteTarget(null);
      showSuccess("Comment deleted");
      fetchDoubt();
    } catch (err) {
      showApiError(err, "Failed to delete comment.");
      setDeleteTarget(null);
    }
  };

  const handleDeleteDoubt = async () => {
    try {
      await api.delete(`/doubts/${doubtId}`);
      showSuccess("Doubt deleted");
      navigate("/doubts");
    } catch (err) {
      showApiError(err, "Failed to delete doubt.");
      setShowDeleteDoubt(false);
    }
  };

  const isMyDoubt = doubt && user && doubt.student_id === user.id;

  if (loading) return <LoadingSpinner fullPage />;
  if (!doubt) return null;

  return (
    <div className="max-w-3xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      <button
        onClick={() => navigate("/doubts")}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Doubts
      </button>

      {/* Doubt Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        {editingDoubt ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Attachment Links</label>
              <div className="space-y-2">
                {editLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => {
                        const updated = [...editLinks];
                        updated[idx] = e.target.value;
                        setEditLinks(updated);
                      }}
                      placeholder="https://drive.google.com/..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    {editLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setEditLinks(editLinks.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600 text-lg px-1"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setEditLinks([...editLinks, ""])}
                className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                + Add another link
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" color="primary" onClick={handleSaveDoubt} disabled={savingDoubt}>
                {savingDoubt ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" color="secondary" onClick={() => setEditingDoubt(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-xl font-semibold text-gray-900">{doubt.title}</h1>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[doubt.status] || ""}`}>
                    {doubt.status}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{doubt.description}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                  <span>By {doubt.student_name}</span>
                  {doubt.book_title && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">{doubt.book_title}</span>
                  )}
                  <span>{new Date(doubt.created_at).toLocaleString()}</span>
                </div>

                {doubt.attachment_links && doubt.attachment_links.length > 0 && (
                  <AttachmentGallery links={doubt.attachment_links} />
                )}
              </div>
            </div>

            {isMyDoubt && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                <Button size="xs" color="primary" onClick={startEditingDoubt}>
                  Edit Doubt
                </Button>
                <Button size="xs" color="danger" onClick={() => setShowDeleteDoubt(true)}>
                  Delete Doubt
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Comments */}
      <h2 className="text-sm font-semibold text-gray-800 mb-3">
        Comments ({doubt.comments.length})
      </h2>

      <div className="space-y-3 mb-6">
        {doubt.comments.map((comment) => {
          const isMyComment = user && comment.user_id === user.id;

          return (
            <div key={comment.id} className="bg-white rounded-lg border border-gray-200 p-4">
              {editingComment === comment.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="xs" color="primary" onClick={() => handleUpdateComment(comment.id)}>
                      Save
                    </Button>
                    <Button size="xs" variant="outline" color="secondary" onClick={() => setEditingComment(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-900">{comment.user_name}</span>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                      comment.user_type === "tutor" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {comment.user_type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                  {/* Student can only edit/delete their own comments */}
                  {isMyComment && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => { setEditingComment(comment.id); setEditContent(comment.content); }}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(comment)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Comment */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
        />
        <Button color="primary" size="sm" onClick={handleAddComment} disabled={submitting || !newComment.trim()}>
          {submitting ? "Posting..." : "Post Comment"}
        </Button>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Comment"
        alertMessage="This action cannot be undone."
        message="Are you sure you want to delete this comment?"
        confirmLabel="Delete"
        variant="danger"
        countdownSeconds={5}
        onConfirm={handleDeleteComment}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={showDeleteDoubt}
        title="Delete Doubt"
        alertMessage="This will delete the doubt and all its comments permanently."
        message="Are you sure you want to proceed?"
        confirmLabel="Delete"
        variant="danger"
        countdownSeconds={5}
        onConfirm={handleDeleteDoubt}
        onCancel={() => setShowDeleteDoubt(false)}
      />
    </div>
  );
}
