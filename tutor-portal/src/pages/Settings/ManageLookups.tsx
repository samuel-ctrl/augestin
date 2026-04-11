import { useState, useEffect, useCallback, useRef } from "react";
import {
  PageHeader, LoadingSpinner, Toast, useToast, EmptyState, Button, ConfirmDialog,
} from "@shared";
import api from "../../api/client";
import { useLookups } from "../../context/LookupContext";

interface StandardItem {
  id: string;
  name: string;
  display_order: number;
  student_count: number;
  book_count: number;
}

interface SectionItem {
  id: string;
  name: string;
  display_order: number;
  student_count: number;
}

type Tab = "standards" | "sections";

export default function ManageLookups() {
  const { refetch } = useLookups();
  const { toast, showSuccess, showApiError, dismiss } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("standards");

  // Standards state
  const [standards, setStandards] = useState<StandardItem[]>([]);
  const [stdLoading, setStdLoading] = useState(true);
  const [stdName, setStdName] = useState("");
  const [stdEditing, setStdEditing] = useState<string | null>(null);
  const [stdEditName, setStdEditName] = useState("");
  const [stdSaving, setStdSaving] = useState(false);

  // Sections state
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [secLoading, setSecLoading] = useState(true);
  const [secName, setSecName] = useState("");
  const [secEditing, setSecEditing] = useState<string | null>(null);
  const [secEditName, setSecEditName] = useState("");
  const [secSaving, setSecSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: Tab; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Drag state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const fetchStandards = useCallback(async () => {
    try {
      const res = await api.get("/lookups/standards");
      setStandards(res.data);
    } catch (err) {
      showApiError(err, "Failed to load standards");
    } finally {
      setStdLoading(false);
    }
  }, [showApiError]);

  const fetchSections = useCallback(async () => {
    try {
      const res = await api.get("/lookups/sections");
      setSections(res.data);
    } catch (err) {
      showApiError(err, "Failed to load sections");
    } finally {
      setSecLoading(false);
    }
  }, [showApiError]);

  useEffect(() => {
    fetchStandards();
    fetchSections();
  }, [fetchStandards, fetchSections]);

  // ── Drag handlers ──

  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDragEnd = () => {
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  const handleDrop = async (targetIdx: number) => {
    const sourceIdx = dragIdx.current;
    if (sourceIdx === null || sourceIdx === targetIdx) {
      handleDragEnd();
      return;
    }

    if (activeTab === "standards") {
      const reordered = [...standards];
      const [moved] = reordered.splice(sourceIdx, 1);
      reordered.splice(targetIdx, 0, moved);
      setStandards(reordered);
      handleDragEnd();
      try {
        await api.post("/lookups/standards/reorder", { ids: reordered.map((s) => s.id) });
        await refetch();
      } catch (err) {
        showApiError(err, "Failed to reorder");
        await fetchStandards();
      }
    } else {
      const reordered = [...sections];
      const [moved] = reordered.splice(sourceIdx, 1);
      reordered.splice(targetIdx, 0, moved);
      setSections(reordered);
      handleDragEnd();
      try {
        await api.post("/lookups/sections/reorder", { ids: reordered.map((s) => s.id) });
        await refetch();
      } catch (err) {
        showApiError(err, "Failed to reorder");
        await fetchSections();
      }
    }
  };

  // ── Standards handlers ──

  const handleCreateStandard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stdName.trim()) return;
    setStdSaving(true);
    try {
      await api.post("/lookups/standards", { name: stdName.trim() });
      setStdName("");
      await fetchStandards();
      await refetch();
      showSuccess("Standard created");
    } catch (err) {
      showApiError(err, "Failed to create standard");
    } finally {
      setStdSaving(false);
    }
  };

  const handleUpdateStandard = async (id: string) => {
    if (!stdEditName.trim()) return;
    setStdSaving(true);
    try {
      await api.put(`/lookups/standards/${id}`, { name: stdEditName.trim() });
      setStdEditing(null);
      await fetchStandards();
      await refetch();
      showSuccess("Standard updated");
    } catch (err) {
      showApiError(err, "Failed to update standard");
    } finally {
      setStdSaving(false);
    }
  };

  // ── Sections handlers ──

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secName.trim()) return;
    setSecSaving(true);
    try {
      await api.post("/lookups/sections", { name: secName.trim() });
      setSecName("");
      await fetchSections();
      await refetch();
      showSuccess("Section created");
    } catch (err) {
      showApiError(err, "Failed to create section");
    } finally {
      setSecSaving(false);
    }
  };

  const handleUpdateSection = async (id: string) => {
    if (!secEditName.trim()) return;
    setSecSaving(true);
    try {
      await api.put(`/lookups/sections/${id}`, { name: secEditName.trim() });
      setSecEditing(null);
      await fetchSections();
      await refetch();
      showSuccess("Section updated");
    } catch (err) {
      showApiError(err, "Failed to update section");
    } finally {
      setSecSaving(false);
    }
  };

  // ── Delete handler ──

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/lookups/${deleteConfirm.type}/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      if (deleteConfirm.type === "standards") await fetchStandards();
      else await fetchSections();
      await refetch();
      showSuccess("Deleted successfully");
    } catch (err) {
      showApiError(err, "Cannot delete");
    } finally {
      setDeleting(false);
    }
  };

  const inputClass = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";
  const cellClass = "px-4 py-3 text-sm";
  const dragHandle = (
    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
    </svg>
  );

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader title="Manage Standards & Sections" />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5">
        <button
          onClick={() => setActiveTab("standards")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "standards"
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Standards
        </button>
        <button
          onClick={() => setActiveTab("sections")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "sections"
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Sections
        </button>
      </div>

      {/* Standards Tab */}
      {activeTab === "standards" && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <form onSubmit={handleCreateStandard} className="flex gap-2 mb-4">
            <input
              type="text"
              value={stdName}
              onChange={(e) => setStdName(e.target.value)}
              placeholder="Standard name (e.g. 13)"
              className={`${inputClass} flex-1`}
              required
            />
            <Button type="submit" loading={stdSaving} size="sm">Add</Button>
          </form>

          {stdLoading ? (
            <LoadingSpinner />
          ) : standards.length === 0 ? (
            <EmptyState icon={<span>-</span>} title="No standards" description="Add your first standard above." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
                    <th className="px-2 py-2 w-8"></th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Students</th>
                    <th className="px-4 py-2">Books</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {standards.map((s, idx) => (
                    <tr
                      key={s.id}
                      draggable={stdEditing !== s.id}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDrop={() => handleDrop(idx)}
                      className={`border-b border-gray-100 transition-colors ${
                        dragOverIdx === idx && dragIdx.current !== idx
                          ? "bg-primary-50 border-primary-300"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {stdEditing === s.id ? (
                        <>
                          <td className="px-2 py-3"></td>
                          <td className={cellClass}>
                            <input
                              type="text"
                              value={stdEditName}
                              onChange={(e) => setStdEditName(e.target.value)}
                              className={`${inputClass} w-full`}
                              autoFocus
                            />
                          </td>
                          <td className={cellClass}>{s.student_count}</td>
                          <td className={cellClass}>{s.book_count}</td>
                          <td className={`${cellClass} text-right`}>
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" onClick={() => handleUpdateStandard(s.id)} loading={stdSaving}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setStdEditing(null)}>Cancel</Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-3 cursor-grab active:cursor-grabbing">{dragHandle}</td>
                          <td className={`${cellClass} font-medium`}>{s.name}</td>
                          <td className={cellClass}>{s.student_count}</td>
                          <td className={cellClass}>{s.book_count}</td>
                          <td className={`${cellClass} text-right`}>
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setStdEditing(s.id); setStdEditName(s.name); }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                color="danger"
                                onClick={() => setDeleteConfirm({ type: "standards", id: s.id, name: s.name })}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-2">Drag rows to reorder</p>
            </div>
          )}
        </div>
      )}

      {/* Sections Tab */}
      {activeTab === "sections" && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <form onSubmit={handleCreateSection} className="flex gap-2 mb-4">
            <input
              type="text"
              value={secName}
              onChange={(e) => setSecName(e.target.value)}
              placeholder="Section name (e.g. F)"
              className={`${inputClass} flex-1`}
              required
            />
            <Button type="submit" loading={secSaving} size="sm">Add</Button>
          </form>

          {secLoading ? (
            <LoadingSpinner />
          ) : sections.length === 0 ? (
            <EmptyState icon={<span>-</span>} title="No sections" description="Add your first section above." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
                    <th className="px-2 py-2 w-8"></th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Students</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((s, idx) => (
                    <tr
                      key={s.id}
                      draggable={secEditing !== s.id}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDrop={() => handleDrop(idx)}
                      className={`border-b border-gray-100 transition-colors ${
                        dragOverIdx === idx && dragIdx.current !== idx
                          ? "bg-primary-50 border-primary-300"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {secEditing === s.id ? (
                        <>
                          <td className="px-2 py-3"></td>
                          <td className={cellClass}>
                            <input
                              type="text"
                              value={secEditName}
                              onChange={(e) => setSecEditName(e.target.value)}
                              className={`${inputClass} w-full`}
                              autoFocus
                            />
                          </td>
                          <td className={cellClass}>{s.student_count}</td>
                          <td className={`${cellClass} text-right`}>
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" onClick={() => handleUpdateSection(s.id)} loading={secSaving}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setSecEditing(null)}>Cancel</Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-3 cursor-grab active:cursor-grabbing">{dragHandle}</td>
                          <td className={`${cellClass} font-medium`}>{s.name}</td>
                          <td className={cellClass}>{s.student_count}</td>
                          <td className={`${cellClass} text-right`}>
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setSecEditing(s.id); setSecEditName(s.name); }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                color="danger"
                                onClick={() => setDeleteConfirm({ type: "sections", id: s.id, name: s.name })}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-2">Drag rows to reorder</p>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title={`Delete "${deleteConfirm?.name}"?`}
        message="If students or books are using this value, deletion will be blocked."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
