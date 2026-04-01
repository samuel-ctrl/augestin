import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LoadingSpinner, Toast, useToast, Button } from "@shared";
import api from "../../api/client";

export default function TestSetForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const { toast, showApiError, dismiss } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isEdit && id) {
          const res = await api.get(`/test-sets/${id}`);
          const ts = res.data;
          setName(ts.name);
          setDescription(ts.description || "");
          setThumbnailUrl(ts.thumbnail_url || "");
        }
      } catch (err) {
        showApiError(err, "Failed to load data.");
        navigate("/test-sets");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEdit, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showApiError(null, "Test Set name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        description: description || null,
        thumbnail_url: thumbnailUrl.trim() || null,
      };

      let newId = id;
      if (isEdit) {
        await api.put(`/test-sets/${id}`, payload);
      } else {
        const res = await api.post("/test-sets", payload);
        newId = res.data.id;
      }

      navigate(`/test-sets/${newId}/files`);
    } catch (err: unknown) {
      showApiError(err, "Failed to save test set. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="max-w-2xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <button
        onClick={() => navigate("/test-sets")}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Test Sets
      </button>

      <h1 className="text-xl font-semibold text-gray-800 mb-6">
        {isEdit ? "Edit Test Set" : "Create New Test Set"}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Chapter 1 Test"
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
              placeholder="Describe this test set..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Thumbnail URL
            </label>
            <input
              type="text"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" color="secondary" onClick={() => navigate("/test-sets")}>
            Cancel
          </Button>
          <Button type="submit" color={isEdit ? "primary" : "success"} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Update Test Set" : "Create Test Set"}
          </Button>
        </div>
      </form>
    </div>
  );
}
