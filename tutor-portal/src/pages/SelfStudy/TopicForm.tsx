import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { LoadingSpinner, Toast, useToast, Button } from "@shared";
import api from "../../api/client";

export default function TopicForm() {
  // Create: /self-study/books/:bookId/topics/new
  // Edit:   /self-study/topics/:topicId/edit
  const { bookId, topicId } = useParams<{ bookId: string; topicId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!topicId;

  const [resolvedBookId, setResolvedBookId] = useState(bookId || "");
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const { toast, showApiError, dismiss } = useToast();

  useEffect(() => {
    if (isEdit && topicId) {
      api
        .get(`/topics/${topicId}`)
        .then((res) => {
          const t = res.data;
          setTitle(t.title);
          setVideoUrl(t.video_url || "");
          setImageUrl(t.image_url || "");
          setResolvedBookId(t.book_id);
        })
        .catch((err) => {
          showApiError(err, "Failed to load topic.");
          navigate("/self-study");
        })
        .finally(() => setLoading(false));
    }
  }, [topicId, isEdit, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title,
        video_url: videoUrl.trim() || null,
        image_url: imageUrl.trim() || null,
      };
      if (isEdit) {
        await api.put(`/topics/${topicId}`, payload);
      } else {
        await api.post(`/books/${resolvedBookId}/topics`, payload);
      }
      navigate(`/self-study/books/${resolvedBookId}/topics`);
    } catch (err) {
      showApiError(err, "Failed to save topic.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";

  return (
    <div className="max-w-lg mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <button
        onClick={() => navigate(`/self-study/books/${resolvedBookId}/topics`)}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Topics
      </button>

      <h1 className="text-xl font-semibold text-gray-800 mb-6">
        {isEdit ? "Edit Topic" : "Add Topic"}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Introduction to Algebra"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video URL (optional)
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://drive.google.com/file/d/.../view"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-400">
            Google Drive link or any direct video URL. Students must watch to complete this topic.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cover Image URL (optional)
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-400">
            Displayed as a topic thumbnail.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button" variant="outline" color="secondary" fullWidth
            onClick={() => navigate(`/self-study/books/${resolvedBookId}/topics`)}
          >
            Cancel
          </Button>
          <Button type="submit" color={isEdit ? "primary" : "success"} fullWidth disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Update Topic" : "Create Topic"}
          </Button>
        </div>
      </form>
    </div>
  );
}
