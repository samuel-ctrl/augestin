import { useState, useCallback } from "react";
import {
  PageHeader, DataTable, Toast, useToast, Button, ConfirmDialog, FormDialog,
} from "@shared";
import type { ColumnDef, PaginatedResponse, TableQueryParams, DropdownMenuItem } from "@shared";
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
  const [refreshKey, setRefreshKey] = useState(0);

  // Inline edit
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: Tab; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reorder
  const [reordering, setReordering] = useState<string | null>(null);

  const reload = () => setRefreshKey((k) => k + 1);

  // ── Fetch wrappers (list → PaginatedResponse) ──

  const fetchStandards = useCallback(async (params: TableQueryParams): Promise<PaginatedResponse<StandardItem>> => {
    const res = await api.get("/lookups/standards");
    let items: StandardItem[] = res.data;
    if (params.search) {
      const s = params.search.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(s));
    }
    return { items, total: items.length, page: 1, page_size: items.length || 1, total_pages: 1 };
  }, []);

  const fetchSections = useCallback(async (params: TableQueryParams): Promise<PaginatedResponse<SectionItem>> => {
    const res = await api.get("/lookups/sections");
    let items: SectionItem[] = res.data;
    if (params.search) {
      const s = params.search.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(s));
    }
    return { items, total: items.length, page: 1, page_size: items.length || 1, total_pages: 1 };
  }, []);

  // ── Create ──

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post(`/lookups/${activeTab}`, { name: newName.trim() });
      setNewName("");
      setCreateOpen(false);
      reload();
      await refetch();
      showSuccess(`${activeTab === "standards" ? "Standard" : "Section"} created`);
    } catch (err) {
      showApiError(err, "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  // ── Update ──

  const handleUpdate = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      await api.put(`/lookups/${activeTab}/${editing.id}`, { name: editing.name.trim() });
      setEditing(null);
      reload();
      await refetch();
      showSuccess("Updated");
    } catch (err) {
      showApiError(err, "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/lookups/${deleteConfirm.type}/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      reload();
      await refetch();
      showSuccess("Deleted");
    } catch (err) {
      showApiError(err, "Cannot delete");
    } finally {
      setDeleting(false);
    }
  };

  // ── Reorder ──

  const handleMove = async (items: { id: string }[], idx: number, dir: -1 | 1) => {
    if (idx + dir < 0 || idx + dir >= items.length) return;
    const ids = items.map((i) => i.id);
    [ids[idx], ids[idx + dir]] = [ids[idx + dir], ids[idx]];
    setReordering(ids[idx + dir]);
    try {
      await api.post(`/lookups/${activeTab}/reorder`, { ids });
      reload();
      await refetch();
    } catch (err) {
      showApiError(err, "Failed to reorder");
    } finally {
      setReordering(null);
    }
  };

  // ── Columns ──

  const renderNameCell = (_value: unknown, row: { id: string; name: string }) => {
    if (editing?.id === row.id) {
      return (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            className="px-2 py-1 border border-gray-300 rounded text-sm w-32 focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(); if (e.key === "Escape") setEditing(null); }}
          />
          <Button size="xs" onClick={handleUpdate} loading={saving}>Save</Button>
          <Button size="xs" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
        </div>
      );
    }
    return String(row.name);
  };

  const stdColumns: ColumnDef<StandardItem>[] = [
    { key: "name", label: "Name", sortable: false, render: renderNameCell as ColumnDef<StandardItem>["render"] },
    { key: "student_count", label: "Students", sortable: false },
    { key: "book_count", label: "Books", sortable: false },
  ];

  const secColumns: ColumnDef<SectionItem>[] = [
    { key: "name", label: "Name", sortable: false, render: renderNameCell as ColumnDef<SectionItem>["render"] },
    { key: "student_count", label: "Students", sortable: false },
  ];

  // ── Shared actions renderer ──

  const renderActions = (items: { id: string; name: string }[], row: { id: string; name: string }, idx: number): DropdownMenuItem[] => {
    const menuItems: DropdownMenuItem[] = [];
    if (idx > 0) {
      menuItems.push({ label: "Move Up", onClick: () => handleMove(items, idx, -1) });
    }
    if (idx < items.length - 1) {
      menuItems.push({ label: "Move Down", onClick: () => handleMove(items, idx, 1) });
    }
    menuItems.push({ label: "Edit", onClick: () => setEditing({ id: row.id, name: row.name }) });
    menuItems.push({ label: "Delete", onClick: () => setDeleteConfirm({ type: activeTab, id: row.id, name: row.name }), variant: "danger" });
    return menuItems;
  };

  // We need to track the fetched items for the actions renderer (move up/down)
  const [stdItems, setStdItems] = useState<StandardItem[]>([]);
  const [secItems, setSecItems] = useState<SectionItem[]>([]);

  const wrappedFetchStandards = useCallback(async (params: TableQueryParams) => {
    const result = await fetchStandards(params);
    setStdItems(result.items);
    return result;
  }, [fetchStandards]);

  const wrappedFetchSections = useCallback(async (params: TableQueryParams) => {
    const result = await fetchSections(params);
    setSecItems(result.items);
    return result;
  }, [fetchSections]);

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader title="Manage" />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5">
        <button
          onClick={() => { setActiveTab("standards"); setEditing(null); }}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "standards"
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Standards
        </button>
        <button
          onClick={() => { setActiveTab("sections"); setEditing(null); }}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "sections"
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Sections
        </button>
      </div>

      {/* Table */}
      {activeTab === "standards" ? (
        <DataTable<StandardItem>
          key={`std-${refreshKey}`}
          fetchFn={wrappedFetchStandards}
          columns={stdColumns}
          searchPlaceholder="Search standards..."
          defaultSortBy="display_order"
          rowKey={(s) => s.id}
          addButtonLabel="+ Add Standard"
          onAddClick={() => { setNewName(""); setCreateOpen(true); }}
          actions={(row) => {
            const idx = stdItems.findIndex((i) => i.id === row.id);
            return renderActions(stdItems, row, idx);
          }}
        />
      ) : (
        <DataTable<SectionItem>
          key={`sec-${refreshKey}`}
          fetchFn={wrappedFetchSections}
          columns={secColumns}
          searchPlaceholder="Search sections..."
          defaultSortBy="display_order"
          rowKey={(s) => s.id}
          addButtonLabel="+ Add Section"
          onAddClick={() => { setNewName(""); setCreateOpen(true); }}
          actions={(row) => {
            const idx = secItems.findIndex((i) => i.id === row.id);
            return renderActions(secItems, row, idx);
          }}
        />
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

      <FormDialog
        open={createOpen}
        title={`Add ${activeTab === "standards" ? "Standard" : "Section"}`}
        submitLabel="Create"
        loading={creating}
        submitDisabled={!newName.trim()}
        onSubmit={handleCreate}
        onCancel={() => { setCreateOpen(false); setNewName(""); }}
      >
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Enter ${activeTab === "standards" ? "standard" : "section"} name`}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          autoFocus
        />
      </FormDialog>
    </div>
  );
}
