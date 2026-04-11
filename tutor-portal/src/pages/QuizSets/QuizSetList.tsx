import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  DataTable,
  ConfirmDialog,
  Toast,
  useToast,
  PageHeader,
} from "@shared";
import type { QuizSet, ColumnDef, PaginatedResponse, TableQueryParams, DropdownMenuItem } from "@shared";
import api from "../../api/client";

export default function QuizSetList() {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<QuizSet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  const fetchQuizSets = useCallback(async (params: TableQueryParams): Promise<PaginatedResponse<QuizSet>> => {
    const res = await api.get("/quiz-sets", { params });
    return res.data;
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/quiz-sets/${deleteTarget.id}`);
      showSuccess(`Quiz Set "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showApiError(err, "Failed to delete quiz set.");
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<QuizSet>[] = [
    { key: "name", label: "Name", sortable: true },
    {
      key: "question_count",
      label: "Questions",
      sortable: false,
      width: "120px",
      render: (val) => `${val} Q${val !== 1 ? "s" : ""}`,
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      width: "150px",
      render: (val) => val ? new Date(val as string).toLocaleDateString() : "—",
    },
  ];

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader title="Quizzes" />

      <DataTable<QuizSet>
        key={refreshKey}
        fetchFn={fetchQuizSets}
        columns={columns}
        searchPlaceholder="Search quizzes..."
        defaultSortBy="created_at"
        defaultSortOrder="desc"
        rowKey={(qs) => qs.id}
        addButtonLabel="+ New Quiz Set"
        onAddClick={() => navigate("/quiz-sets/new")}
        actions={(row): DropdownMenuItem[] => [
          { label: "Questions", onClick: () => navigate(`/quiz-sets/${row.id}/questions`) },
          { label: "Assign", onClick: () => navigate(`/quiz-sets/${row.id}/assign`) },
          { label: "Edit", onClick: () => navigate(`/quiz-sets/${row.id}/edit`) },
          { label: "Delete", onClick: () => setDeleteTarget(row), variant: "danger" },
        ]}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Quiz Set"
        alertMessage="This action cannot be undone."
        message="Are you sure you want to delete this quiz set?"
        confirmLabel="Delete"
        variant="danger"
        countdownSeconds={5}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
