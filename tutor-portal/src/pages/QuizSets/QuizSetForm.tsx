import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LoadingSpinner, Toast, useToast } from "@shared";
import type { Subject } from "@shared";
import api from "../../api/client";

interface QuizSetData {
  name: string;
  description?: string;
  thumbnail_url?: string;
  subject_id: string;
  sort_order: number;
}

export default function QuizSetForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const { toast, showApiError, dismiss } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const subjectsRes = await api.get("/subjects", {
          params: { page: 1, page_size: 100 },
        });
        setSubjects(subjectsRes.data.items);

        if (isEdit && id) {
          const quizSetRes = await api.get(`/quiz-sets/${id}`);
          const qs = quizSetRes.data;
          setName(qs.name);
          setDescription(qs.description || "");
          setSubjectId(qs.subject_id);
          setSortOrder(qs.sort_order);
          setThumbnailUrl(qs.thumbnail_url || "");
        }
      } catch (err) {
        showApiError(err, "Failed to load data.");
        navigate("/quiz-sets");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEdit, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showApiError(null, "Quiz Set name is required");
      return;
    }

    if (!subjectId) {
      showApiError(null, "Subject is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        description: description || null,
        subject_id: subjectId,
        sort_order: sortOrder,
        thumbnail_url: thumbnailUrl.trim() || null,
      };

      let newQuizSetId = id;
      if (isEdit) {
        await api.put(`/quiz-sets/${id}`, payload);
      } else {
        const res = await api.post("/quiz-sets", payload);
        newQuizSetId = res.data.id;
      }

      navigate(`/quiz-sets/${newQuizSetId}/questions`);
    } catch (err: unknown) {
      showApiError(err, "Failed to save quiz set. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="max-w-2xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <button
        onClick={() => navigate("/quiz-sets")}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Quiz Sets
      </button>

      <h1 className="text-xl font-semibold text-gray-800 mb-6">
        {isEdit ? "Edit Quiz Set" : "Create New Quiz Set"}
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
              placeholder="e.g., Algebra Basics"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject *
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Select a subject...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this quiz set..."
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={() => navigate("/quiz-sets")}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : isEdit ? "Update Quiz Set" : "Create Quiz Set"}
          </button>
        </div>
      </form>
    </div>
  );
}
