import { useState, useEffect, useCallback } from "react";
import {
  PageHeader, LoadingSpinner, Toast, useToast, extractErrorMessage, EmptyState, Button, ConfirmDialog,
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

export default function ManageLookups() {
  const { refetch } = useLookups();
  const { toast, showSuccess, showApiError, dismiss } = useToast();

  // Standards state
  const [standards, setStandards] = useState<StandardItem[]>([]);
  const [stdLoading, setStdLoading] = useState(true);
  const [stdForm, setStdForm] = useState({ name: "", display_order: "" });
  const [stdEditing, setStdEditing] = useState<string | null>(null);
  const [stdEditForm, setStdEditForm] = useState({ name: "", display_order: "" });
  const [stdSaving, setStdSaving] = useState(false);

  // Sections state
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [secLoading, setSecLoading] = useState(true);
  const [secForm, setSecForm] = useState({ name: "", display_order: "" });
  const [secEditing, setSecEditing] = useState<string | null>(null);
  const [secEditForm, setSecEditForm] = useState({ name: "", display_order: "" });
  const [secSaving, setSecSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "standard" | "section"; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // ── Standards handlers ──

  const handleCreateStandard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stdForm.name.trim()) return;
    setStdSaving(true);
    try {
      const payload: Record<string, any> = { name: stdForm.name.trim() };
      if (stdForm.display_order !== "") payload.display_order = Number(stdForm.display_order);
      await api.post("/lookups/standards", payload);
      setStdForm({ name: "", display_order: "" });
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
    setStdSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (stdEditForm.name.trim()) payload.name = stdEditForm.name.trim();
      if (stdEditForm.display_order !== "") payload.display_order = Number(stdEditForm.display_order);
      await api.put(`/lookups/standards/${id}`, payload);
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
    if (!secForm.name.trim()) return;
    setSecSaving(true);
    try {
      const payload: Record<string, any> = { name: secForm.name.trim() };
      if (secForm.display_order !== "") payload.display_order = Number(secForm.display_order);
      await api.post("/lookups/sections", payload);
      setSecForm({ name: "", display_order: "" });
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
    setSecSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (secEditForm.name.trim()) payload.name = secEditForm.name.trim();
      if (secEditForm.display_order !== "") payload.display_order = Number(secEditForm.display_order);
      await api.put(`/lookups/sections/${id}`, payload);
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

  // ── Delete handler (shared) ──

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/lookups/${deleteConfirm.type}s/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      if (deleteConfirm.type === "standard") await fetchStandards();
      else await fetchSections();
      await refetch();
      showSuccess(`${deleteConfirm.type === "standard" ? "Standard" : "Section"} deleted`);
    } catch (err) {
      showApiError(err, "Cannot delete");
    } finally {
      setDeleting(false);
    }
  };

  const inputClass = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";
  const cellClass = "px-4 py-3 text-sm";

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader title="Manage Standards & Sections" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Standards ── */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Standards</h2>

          <form onSubmit={handleCreateStandard} className="flex gap-2 mb-4">
            <input
              type="text"
              value={stdForm.name}
              onChange={(e) => setStdForm({ ...stdForm, name: e.target.value })}
              placeholder="Name (e.g. 13)"
              className={`${inputClass} flex-1`}
              required
            />
            <input
              type="number"
              value={stdForm.display_order}
              onChange={(e) => setStdForm({ ...stdForm, display_order: e.target.value })}
              placeholder="Order"
              className={`${inputClass} w-20`}
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
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Order</th>
                    <th className="px-4 py-2">Students</th>
                    <th className="px-4 py-2">Books</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {standards.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {stdEditing === s.id ? (
                        <>
                          <td className={cellClass}>
                            <input
                              type="text"
                              value={stdEditForm.name}
                              onChange={(e) => setStdEditForm({ ...stdEditForm, name: e.target.value })}
                              className={`${inputClass} w-full`}
                            />
                          </td>
                          <td className={cellClass}>
                            <input
                              type="number"
                              value={stdEditForm.display_order}
                              onChange={(e) => setStdEditForm({ ...stdEditForm, display_order: e.target.value })}
                              className={`${inputClass} w-16`}
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
                          <td className={`${cellClass} font-medium`}>{s.name}</td>
                          <td className={cellClass}>{s.display_order}</td>
                          <td className={cellClass}>{s.student_count}</td>
                          <td className={cellClass}>{s.book_count}</td>
                          <td className={`${cellClass} text-right`}>
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setStdEditing(s.id);
                                  setStdEditForm({ name: s.name, display_order: String(s.display_order) });
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                color="danger"
                                onClick={() => setDeleteConfirm({ type: "standard", id: s.id, name: s.name })}
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
            </div>
          )}
        </div>

        {/* ── Sections ── */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sections</h2>

          <form onSubmit={handleCreateSection} className="flex gap-2 mb-4">
            <input
              type="text"
              value={secForm.name}
              onChange={(e) => setSecForm({ ...secForm, name: e.target.value })}
              placeholder="Name (e.g. F)"
              className={`${inputClass} flex-1`}
              required
            />
            <input
              type="number"
              value={secForm.display_order}
              onChange={(e) => setSecForm({ ...secForm, display_order: e.target.value })}
              placeholder="Order"
              className={`${inputClass} w-20`}
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
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Order</th>
                    <th className="px-4 py-2">Students</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {secEditing === s.id ? (
                        <>
                          <td className={cellClass}>
                            <input
                              type="text"
                              value={secEditForm.name}
                              onChange={(e) => setSecEditForm({ ...secEditForm, name: e.target.value })}
                              className={`${inputClass} w-full`}
                            />
                          </td>
                          <td className={cellClass}>
                            <input
                              type="number"
                              value={secEditForm.display_order}
                              onChange={(e) => setSecEditForm({ ...secEditForm, display_order: e.target.value })}
                              className={`${inputClass} w-16`}
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
                          <td className={`${cellClass} font-medium`}>{s.name}</td>
                          <td className={cellClass}>{s.display_order}</td>
                          <td className={cellClass}>{s.student_count}</td>
                          <td className={`${cellClass} text-right`}>
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSecEditing(s.id);
                                  setSecEditForm({ name: s.name, display_order: String(s.display_order) });
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                color="danger"
                                onClick={() => setDeleteConfirm({ type: "section", id: s.id, name: s.name })}
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
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title={`Delete ${deleteConfirm?.type === "standard" ? "Standard" : "Section"} "${deleteConfirm?.name}"?`}
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
