import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoadingSpinner, Toast, useToast, Button } from "@shared";
import api from "../../api/client";

interface BookOption {
  id: string;
  title: string;
}

export default function DoubtCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedBookId = searchParams.get("book_id") || "";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bookId, setBookId] = useState(preselectedBookId);
  const [links, setLinks] = useState<string[]>([""]);
  const [books, setBooks] = useState<BookOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast, showApiError, dismiss } = useToast();

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const res = await api.get("/students/books");
        const bookList = res.data.items || res.data;
        setBooks(bookList.map((b: any) => ({ id: b.id, title: b.title })));
      } catch {
        // Books are optional, no error needed
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showApiError(null, "Title is required");
      return;
    }
    if (!description.trim()) {
      showApiError(null, "Description is required");
      return;
    }

    setSaving(true);
    try {
      const filteredLinks = links.map(l => l.trim()).filter(Boolean);
      const payload: Record<string, any> = {
        title: title.trim(),
        description: description.trim(),
        attachment_links: filteredLinks,
      };
      if (bookId) payload.book_id = bookId;

      const res = await api.post("/doubts", payload);
      navigate(`/doubts/${res.data.id}`);
    } catch (err) {
      showApiError(err, "Failed to create doubt.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="max-w-2xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <button
        onClick={() => navigate("/doubts")}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Doubts
      </button>

      <h1 className="text-xl font-semibold text-gray-800 mb-6">Ask a Doubt</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your doubt about?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your doubt in detail..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Related Book (Optional)
            </label>
            <select
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">No specific book</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>{book.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attachment Links (Optional)
            </label>
            <p className="text-xs text-gray-400 mb-2">Add Google Drive links to screenshots or proof</p>
            <div className="space-y-2">
              {links.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => {
                      const updated = [...links];
                      updated[idx] = e.target.value;
                      setLinks(updated);
                    }}
                    placeholder="https://drive.google.com/..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {links.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 text-lg px-1"
                      title="Remove link"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLinks([...links, ""])}
              className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              + Add another link
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" color="secondary" onClick={() => navigate("/doubts")}>
            Cancel
          </Button>
          <Button type="submit" color="success" disabled={saving}>
            {saving ? "Posting..." : "Post Doubt"}
          </Button>
        </div>
      </form>
    </div>
  );
}
