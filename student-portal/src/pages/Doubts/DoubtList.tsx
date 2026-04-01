import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LoadingSpinner, EmptyState, Toast, useToast, extractErrorMessage, Button, PageHeader,
} from "@shared";
import type { Doubt, PaginatedResponse } from "@shared";
import api from "../../api/client";

const statusColors: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};

export default function DoubtList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookIdParam = searchParams.get("book_id") || "";
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [myDoubts, setMyDoubts] = useState(false);
  const { toast, dismiss } = useToast();

  const fetchDoubts = useCallback(async () => {
    setError(null);
    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
        search,
        my_doubts: myDoubts,
      };
      if (statusFilter) params.status = statusFilter;
      if (bookIdParam) params.book_id = bookIdParam;

      const res = await api.get<PaginatedResponse<Doubt>>("/doubts", { params });
      setDoubts(res.data.items);
      setTotal(res.data.total);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to load doubts."));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, myDoubts, bookIdParam]);

  useEffect(() => {
    fetchDoubts();
  }, [fetchDoubts]);

  const totalPages = Math.ceil(total / pageSize);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) {
    return (
      <EmptyState
        icon={<span>!</span>}
        title="Something went wrong"
        description={error}
        action={{ label: "Try Again", onClick: () => { setLoading(true); fetchDoubts(); } }}
      />
    );
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title="Doubts"
        actions={
          <Button color="success" onClick={() => navigate("/doubts/new")}>
            + Ask a Doubt
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search doubts..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white cursor-pointer">
          <input
            type="checkbox"
            checked={myDoubts}
            onChange={(e) => { setMyDoubts(e.target.checked); setPage(1); }}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          My Doubts
        </label>
      </div>

      {doubts.length === 0 ? (
        <EmptyState
          icon={<span>💬</span>}
          title="No doubts yet"
          description={myDoubts ? "You haven't asked any doubts yet." : "No doubts have been raised yet. Be the first!"}
          action={{ label: "Ask a Doubt", onClick: () => navigate("/doubts/new") }}
        />
      ) : (
        <div className="space-y-3">
          {doubts.map((doubt) => (
            <div
              key={doubt.id}
              onClick={() => navigate(`/doubts/${doubt.id}`)}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">{doubt.title}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[doubt.status] || "bg-gray-100 text-gray-600"}`}>
                      {doubt.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{doubt.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>By {doubt.student_name}</span>
                    {doubt.book_title && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                        {doubt.book_title}
                      </span>
                    )}
                    <span>{doubt.comment_count} comment{doubt.comment_count !== 1 ? "s" : ""}</span>
                    <span>{new Date(doubt.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-500">Page {page} of {totalPages}</div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
