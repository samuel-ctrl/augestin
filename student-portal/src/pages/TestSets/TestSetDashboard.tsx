import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, Toast, useToast, PageHeader } from "@shared";
import type { AssignedTestSet, ColumnDef, PaginatedResponse, TableQueryParams } from "@shared";
import api from "../../api/client";
import { assetUrl } from "../../api/config";
import { toDirectImageUrl, isGoogleDriveUrl } from "@shared";

function thumbnailSrc(url: string | null | undefined): string {
  if (!url) return DEFAULT_THUMBNAIL;
  if (isGoogleDriveUrl(url)) return toDirectImageUrl(url);
  return assetUrl(url) || DEFAULT_THUMBNAIL;
}

const DEFAULT_THUMBNAIL ="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200' fill='%23e5e7eb'%3E%3Crect width='300' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='40'%3E%F0%9F%93%9D%3C/text%3E%3C/svg%3E";

export default function TestSetDashboard() {
  const navigate = useNavigate();
  const { toast, dismiss } = useToast();

  const fetchTestSets = useCallback(async (params: TableQueryParams): Promise<PaginatedResponse<AssignedTestSet>> => {
    const res = await api.get("/students/test-sets");
    const items: AssignedTestSet[] = res.data.items || res.data;
    // Client-side pagination wrapper
    const start = (params.page - 1) * params.page_size;
    const paged = items.slice(start, start + params.page_size);
    return {
      items: paged,
      total: items.length,
      page: params.page,
      page_size: params.page_size,
      total_pages: Math.ceil(items.length / params.page_size),
    };
  }, []);

  const columns: ColumnDef<AssignedTestSet>[] = [
    {
      key: "thumbnail_url",
      label: "",
      sortable: false,
      width: "72px",
      render: (_val, row) => (
        <div className="w-14 h-10 bg-gray-200 dark:bg-gray-600 rounded overflow-hidden">
          <img
            src={thumbnailSrc(row.thumbnail_url)}
            alt={row.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_THUMBNAIL; }}
          />
        </div>
      ),
    },
    { key: "name", label: "Name", sortable: false },
    {
      key: "file_count",
      label: "Files",
      sortable: false,
      width: "100px",
      render: (val) => `${val} file${val !== 1 ? "s" : ""}`,
    },
    {
      key: "submission_status",
      label: "Status",
      sortable: false,
      width: "120px",
      render: (_val, row) =>
        row.submission_status?.has_submitted ? (
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1 w-fit">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            Submitted
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full flex items-center gap-1 w-fit">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
            Not Submitted
          </span>
        ),
    },
  ];

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title="Test Sets"
        subtitle="Tests assigned to you"
      />

      <DataTable<AssignedTestSet>
        fetchFn={fetchTestSets}
        columns={columns}
        searchPlaceholder="Search test sets..."
        rowKey={(ts) => ts.id}
        onRowClick={(ts) => navigate(`/test-sets/${ts.id}`)}
        renderCard={(row) => {
          const submitted = row.submission_status?.has_submitted;
          return (
            <div
              className="bg-[rgb(191_189_207_/_38%)] rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg hover:border-primary-300 transition-all cursor-pointer"
              onClick={() => navigate(`/test-sets/${row.id}`)}
            >
              <div className="mb-3 h-32 bg-gray-200 dark:bg-gray-600 rounded overflow-hidden">
                <img
                  src={thumbnailSrc(row.thumbnail_url)}
                  alt={row.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_THUMBNAIL; }}
                />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-50 text-sm line-clamp-2">
                {row.name}
              </h3>
              {row.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{row.description}</p>}
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {row.file_count} file{row.file_count !== 1 ? "s" : ""}
                </span>
                {submitted ? (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    Submitted
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                    Not Submitted
                  </span>
                )}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
