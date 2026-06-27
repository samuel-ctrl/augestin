import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import {
  LoadingSpinner,
  EmptyState,
  ConfirmDialog,
  Toast,
  useToast,
  extractErrorMessage,
  Button,
} from "@shared";
import type { Topic } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";

interface BookInfo {
  id: string;
  title: string;
  subject_id: string;
  description?: string;
  standard: string;
}

interface BookTest {
  id: string;
  drive_link: string;
  instructions?: string;
}

export default function BookTopics() {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const [book, setBook] = useState<BookInfo | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [test, setTest] = useState<BookTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null);
  const [reordering, setReordering] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [bookRes, topicsRes, testRes] = await Promise.all([
        api.get(`/books/${bookId}`),
        api.get(`/books/${bookId}/topics`),
        api.get(`/books/${bookId}/test`).catch(() => ({ data: null })),
      ]);
      setBook(bookRes.data);
      const sorted = [...(topicsRes.data || [])].sort(
        (a: Topic, b: Topic) => a.position - b.position
      );
      setTopics(sorted);
      setTest(testRes.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        navigate(-1);
      } else {
        setError(extractErrorMessage(err, "Failed to load book."));
      }
    } finally {
      setLoading(false);
    }
  }, [bookId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReorder = async (fromIdx: number, toIdx: number) => {
    const reordered = [...topics];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setTopics(reordered);
    setReordering(true);
    try {
      await api.put(`/books/${bookId}/topics/reorder`, {
        topic_ids: reordered.map((t) => t.id),
      });
    } catch (err) {
      showApiError(err, "Failed to reorder topics.");
      fetchData();
    } finally {
      setReordering(false);
    }
  };

  const handleDeleteTopic = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/topics/${deleteTarget.id}`);
      showSuccess(`Topic "${deleteTarget.title}" deleted.`);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      setDeleteTarget(null);
      showApiError(err, "Failed to delete topic.");
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => { setError(null); setLoading(true); fetchData(); } }}
      />
    );
  }
  if (!book) return null;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/self-study/subjects/${book.subject_id}`)}
          className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-flex items-center gap-1"
        >
          &larr; Back to Books
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">{book.title}</h1>
            {book.description && (
              <p className="text-sm text-gray-500 mt-0.5">{book.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              color="secondary"
              size="sm"
              onClick={() => navigate(`/self-study/books/${bookId}/assign`)}
            >
              Assign
            </Button>
            <Button
              variant="outline"
              color="primary"
              size="sm"
              onClick={() => navigate(`/self-study/books/${bookId}/edit`)}
            >
              Edit Book
            </Button>
          </div>
        </div>
      </div>

      {/* Topics section */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Topics</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {topics.length} topic{topics.length !== 1 ? "s" : ""} — students unlock them in order
            </p>
          </div>
          <Button
            color="success"
            size="sm"
            onClick={() => navigate(`/self-study/books/${bookId}/topics/new`)}
          >
            + Add Topic
          </Button>
        </div>

        {topics.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<span>📚</span>}
              title="No topics yet"
              description="Add topics to this book. Students will work through them in order."
              action={{
                label: "Add First Topic",
                onClick: () => navigate(`/self-study/books/${bookId}/topics/new`),
              }}
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {topics.map((topic, idx) => (
              <TopicRow
                key={topic.id}
                topic={topic}
                idx={idx}
                total={topics.length}
                reordering={reordering}
                onMoveUp={() => handleReorder(idx, idx - 1)}
                onMoveDown={() => handleReorder(idx, idx + 1)}
                onEdit={() => navigate(`/self-study/topics/${topic.id}/edit`)}
                onNotes={() => navigate(`/self-study/topics/${topic.id}/notes`)}
                onQuiz={() => navigate(`/self-study/topics/${topic.id}/questions`)}
                onDelete={() => setDeleteTarget(topic)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Test section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Book Test</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Unlocked when all topics are completed
            </p>
          </div>
          <Button
            variant="outline"
            color={test ? "primary" : "success"}
            size="sm"
            onClick={() => navigate(`/self-study/books/${bookId}/test`)}
          >
            {test ? "Manage Test" : "Create Test"}
          </Button>
        </div>
        <div className="px-5 py-4">
          {test ? (
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <div>
                <p className="text-sm text-gray-700">Test configured</p>
                {test.instructions && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{test.instructions}</p>
                )}
              </div>
              <a
                href={test.drive_link}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-primary-600 hover:underline"
              >
                View file ↗
              </a>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No test configured yet.</p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Topic"
        alertMessage="All notes, questions, and student progress for this topic will be removed."
        message={`Are you sure you want to delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete"
        variant="danger"
        countdownSeconds={5}
        onConfirm={handleDeleteTopic}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

interface TopicRowProps {
  topic: Topic;
  idx: number;
  total: number;
  reordering: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onNotes: () => void;
  onQuiz: () => void;
  onDelete: () => void;
}

function TopicRow({
  topic,
  idx,
  total,
  reordering,
  onMoveUp,
  onMoveDown,
  onEdit,
  onNotes,
  onQuiz,
  onDelete,
}: TopicRowProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
      {/* Position */}
      <span className="w-6 text-center text-xs font-semibold text-gray-400 shrink-0">
        {idx + 1}
      </span>

      {/* Thumbnail or placeholder */}
      {topic.image_url ? (
        <img
          src={assetUrl(topic.image_url)}
          alt=""
          className="w-10 h-10 rounded object-cover shrink-0 border border-gray-200"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="w-10 h-10 rounded bg-gray-100 shrink-0 flex items-center justify-center text-gray-300 text-lg border border-gray-200">
          📖
        </div>
      )}

      {/* Title + badges */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{topic.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {topic.video_url && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
              Video
            </span>
          )}
          {topic.has_notes && (
            <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">
              Notes
            </span>
          )}
          {topic.question_count > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-primary-50 text-primary-600 rounded">
              {topic.question_count} Q{topic.question_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Reorder arrows */}
        <button
          onClick={onMoveUp}
          disabled={idx === 0 || reordering}
          className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Move up"
        >
          ↑
        </button>
        <button
          onClick={onMoveDown}
          disabled={idx === total - 1 || reordering}
          className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Move down"
        >
          ↓
        </button>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <Button variant="ghost" color="secondary" size="xs" onClick={onNotes}>
          Notes
        </Button>
        <Button variant="ghost" color="primary" size="xs" onClick={onQuiz}>
          Quiz
        </Button>
        <Button variant="ghost" color="secondary" size="xs" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" color="danger" size="xs" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
