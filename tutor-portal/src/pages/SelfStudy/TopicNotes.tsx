import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LoadingSpinner, EmptyState, Toast, useToast, ConfirmDialog, RecapViewer, Button } from "@shared";
import type { TopicNotes as TopicNotesType } from "@shared";
import api from "../../api/client";
import RecapEditor from "../../components/RecapEditor";

interface TopicInfo {
  id: string;
  title: string;
  book_id: string;
}

export default function TopicNotes() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const [topic, setTopic] = useState<TopicInfo | null>(null);
  const [notes, setNotes] = useState<TopicNotesType | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showNavConfirm, setShowNavConfirm] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  const titleRef = useRef<string>("");
  const hasUnsavedRef = useRef(false);

  useEffect(() => {
    hasUnsavedRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!hasUnsavedRef.current) return;
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (href && href.startsWith("/")) {
        e.preventDefault();
        setPendingNavPath(href);
        setShowNavConfirm(true);
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const fetchData = useCallback(async () => {
    if (!topicId) return;
    try {
      setLoading(true);
      const [topicRes, notesRes] = await Promise.all([
        api.get<TopicInfo>(`/topics/${topicId}`),
        api.get<TopicNotesType | null>(`/topics/${topicId}/notes`).catch(() => ({ data: null })),
      ]);
      setTopic(topicRes.data);
      if (notesRes.data) {
        setNotes(notesRes.data);
        titleRef.current = notesRes.data.title;
      } else {
        titleRef.current = "";
      }
    } catch (err) {
      showApiError(err, "Failed to load notes.");
    } finally {
      setLoading(false);
    }
  }, [topicId, showApiError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = useCallback(
    async (content: any) => {
      if (!topicId) return;
      const res = await api.post<TopicNotesType>(`/topics/${topicId}/notes`, {
        title: titleRef.current || "Topic Notes",
        content,
      });
      setNotes(res.data);
      showSuccess("Notes saved successfully.");
    },
    [topicId, showSuccess]
  );

  const handleDelete = useCallback(async () => {
    if (!topicId) return;
    try {
      setDeleting(true);
      await api.delete(`/topics/${topicId}/notes`);
      setNotes(null);
      showSuccess("Notes deleted.");
      setShowDeleteConfirm(false);
    } catch (err) {
      showApiError(err, "Failed to delete notes.");
    } finally {
      setDeleting(false);
    }
  }, [topicId, showApiError, showSuccess]);

  const handleTitleChange = useCallback((t: string) => {
    titleRef.current = t;
  }, []);

  if (loading) return <LoadingSpinner fullPage />;

  if (!topic) {
    return (
      <EmptyState icon="📚" title="Topic Not Found" description="The topic you're looking for doesn't exist." />
    );
  }

  return (
    <div className="p-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {/* Breadcrumb */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/self-study/books/${topic.book_id}/topics`)}
          className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-flex items-center gap-1"
        >
          &larr; Back to {topic.title}
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            Notes — {topic.title}
          </h1>
          {notes && (
            <Button color="danger" size="sm" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Notes"}
            </Button>
          )}
        </div>
      </div>

      {isMobile ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">Mobile Editor Not Supported</h3>
              <p className="text-sm text-yellow-700">
                Notes editing is not optimized for mobile. Please use a desktop to edit.
              </p>
            </div>
          </div>
          {notes && (
            <div className="mt-4 pt-4 border-t border-yellow-200">
              <div className="bg-white rounded p-3 text-sm">
                <RecapViewer content={notes.content} title={notes.title} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <RecapEditor
          onSave={handleSave}
          onTitleChange={handleTitleChange}
          onDirtyChange={setHasUnsavedChanges}
          initialTitle={notes?.title}
          initialContent={notes?.content}
        />
      )}

      <ConfirmDialog
        open={showNavConfirm}
        title="Unsaved Changes"
        message="Have you saved your changes?"
        confirmLabel="Yes, leave"
        cancelLabel="No, stay"
        onConfirm={() => {
          setShowNavConfirm(false);
          setHasUnsavedChanges(false);
          if (pendingNavPath) { navigate(pendingNavPath); setPendingNavPath(null); }
        }}
        onCancel={() => { setShowNavConfirm(false); setPendingNavPath(null); }}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Notes"
        alertMessage="This action cannot be undone."
        message="Are you sure you want to delete the notes for this topic?"
        variant="danger"
        countdownSeconds={5}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
}
