import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LoadingSpinner, EmptyState, ConfirmDialog, Toast, useToast, extractErrorMessage, Button,
} from "@shared";
import type { TestSetFile } from "@shared";
import api from "../../api/client";

interface TestSetInfo {
  id: string;
  name: string;
}

export default function TestSetFiles() {
  const { id: testSetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [testSet, setTestSet] = useState<TestSetInfo | null>(null);
  const [files, setFiles] = useState<TestSetFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestSetFile | null>(null);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  // Add/Edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingFile, setEditingFile] = useState<TestSetFile | null>(null);
  const [fileName, setFileName] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get(`/test-sets/${testSetId}`);
      setTestSet({ id: res.data.id, name: res.data.name });
      setFiles(res.data.files || []);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        navigate("/test-sets");
      } else {
        setError(extractErrorMessage(err, "Failed to load test set."));
      }
    } finally {
      setLoading(false);
    }
  }, [testSetId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setShowForm(false);
    setEditingFile(null);
    setFileName("");
    setDriveLink("");
    setInstructions("");
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (file: TestSetFile) => {
    setEditingFile(file);
    setFileName(file.file_name);
    setDriveLink(file.drive_link);
    setInstructions(file.instructions || "");
    setShowForm(true);
  };

  const handleSaveFile = async () => {
    if (!fileName.trim() || !driveLink.trim()) {
      showApiError(null, "File name and drive link are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        file_name: fileName.trim(),
        drive_link: driveLink.trim(),
        instructions: instructions.trim() || null,
      };

      if (editingFile) {
        await api.put(`/test-sets/${testSetId}/files/${editingFile.id}`, payload);
        showSuccess("File updated successfully");
      } else {
        await api.post(`/test-sets/${testSetId}/files`, payload);
        showSuccess("File added successfully");
      }

      resetForm();
      fetchData();
    } catch (err) {
      showApiError(err, "Failed to save file.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/test-sets/${testSetId}/files/${deleteTarget.id}`);
      showSuccess("File deleted successfully");
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      setDeleteTarget(null);
      showApiError(err, "Failed to delete file.");
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => { setLoading(true); fetchData(); } }}
      />
    );
  }
  if (!testSet) return null;

  return (
    <div className="max-w-3xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      <button
        onClick={() => navigate("/test-sets")}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Test Sets
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Manage Files</h1>
          <p className="text-sm text-gray-500">{testSet.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" color="primary" size="sm" onClick={() => navigate(`/test-sets/${testSetId}/edit`)}>
            Edit Test Set
          </Button>
          <Button variant="outline" color="primary" size="sm" onClick={() => navigate(`/test-sets/${testSetId}/assign`)}>
            Assign Students
          </Button>
          <Button color="success" size="sm" onClick={openAddForm}>
            + Add File
          </Button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">
            {editingFile ? "Edit File" : "Add New File"}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File Name *</label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="e.g., Question Paper PDF"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Drive Link *</label>
              <input
                type="url"
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (Optional)</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Any instructions for this file..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" color="secondary" size="sm" onClick={resetForm}>
                Cancel
              </Button>
              <Button color="primary" size="sm" onClick={handleSaveFile} disabled={saving}>
                {saving ? "Saving..." : editingFile ? "Update" : "Add File"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Files List */}
      {files.length === 0 ? (
        <EmptyState
          icon={<span>📄</span>}
          title="No files yet"
          description="Add drive links for students to download."
          action={{ label: "Add File", onClick: openAddForm }}
        />
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{file.file_name}</h3>
                  <a
                    href={file.drive_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:underline mt-1 inline-block truncate max-w-[400px]"
                  >
                    {file.drive_link}
                  </a>
                  {file.instructions && (
                    <p className="text-xs text-gray-500 mt-1">{file.instructions}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <Button variant="ghost" color="primary" size="xs" onClick={() => openEditForm(file)}>
                    Edit
                  </Button>
                  <Button variant="ghost" color="danger" size="xs" onClick={() => setDeleteTarget(file)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete File"
        message="Are you sure you want to delete this file? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteFile}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
