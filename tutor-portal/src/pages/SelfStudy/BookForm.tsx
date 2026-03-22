import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { LoadingSpinner, Toast, useToast, standardOptions } from "@shared";
import api from "../../api/client";

interface BookData {
  title: string;
  description: string;
  standard: string;
  sort_order: number;
  subject_id: string;
  thumbnail_url?: string;
  video_url?: string;
}

export default function BookForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [standard, setStandard] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [subjectId, setSubjectId] = useState(
    searchParams.get("subject_id") || ""
  );
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [existingData, setExistingData] = useState<BookData | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const { toast, showApiError, dismiss } = useToast();

  useEffect(() => {
    if (isEdit) {
      api
        .get(`/books/${id}`)
        .then((res) => {
          const book = res.data;
          setTitle(book.title);
          setDescription(book.description || "");
          setStandard(book.standard);
          setSortOrder(book.sort_order);
          setSubjectId(book.subject_id);
          setVideoUrl(book.video_url || "");
          setThumbnailUrl(book.thumbnail_url || "");
          setExistingData(book);
        })
        .catch((err) => {
          showApiError(err, "Failed to load book details.");
          navigate("/self-study");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEdit && !videoUrl.trim()) {
      showApiError(null, "Video URL is required");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title,
        description: description || null,
        standard,
        sort_order: sortOrder,
      };

      if (!isEdit) {
        payload.video_url = videoUrl;
      } else {
        if (videoUrl.trim()) payload.video_url = videoUrl;
      }

      if (isEdit) {
        // Send empty string to clear, or the URL to update
        payload.thumbnail_url = thumbnailUrl.trim();
      } else if (thumbnailUrl.trim()) {
        payload.thumbnail_url = thumbnailUrl;
      }

      if (isEdit) {
        await api.put(`/books/${id}`, payload);
      } else {
        await api.post(`/subjects/${subjectId}/books`, payload);
      }

      navigate(`/self-study/subjects/${subjectId}`);
    } catch (err: unknown) {
      showApiError(err, "Failed to save book. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="max-w-lg mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <button
        onClick={() =>
          navigate(
            subjectId
              ? `/self-study/subjects/${subjectId}`
              : "/self-study"
          )
        }
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back
      </button>

      <h1 className="text-xl font-semibold text-gray-800 mb-6">
        {isEdit ? "Edit Book" : "Add New Book"}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Standard *
            </label>
            <select
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Select</option>
              {standardOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isEdit ? "Video URL (leave empty to keep current)" : "Video URL *"}
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://drive.google.com/file/d/.../view"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-400">
            Paste a Google Drive sharing link. The file must be shared as "Anyone with the link can view".
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Thumbnail URL (optional)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {isEdit && thumbnailUrl && (
              <button
                type="button"
                onClick={() => setThumbnailUrl("")}
                className="px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Paste a direct image URL (Google Drive image link or any public image URL).
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() =>
              navigate(
                subjectId
                  ? `/self-study/subjects/${subjectId}`
                  : "/self-study"
              )
            }
            className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : isEdit ? "Update Book" : "Create Book"}
          </button>
        </div>
      </form>
    </div>
  );
}
