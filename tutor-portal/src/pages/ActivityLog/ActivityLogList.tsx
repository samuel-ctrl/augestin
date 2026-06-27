import { useEffect, useMemo, useState } from "react";
import { Button, DataTable, PageHeader, Toast, useToast } from "@shared";
import type {
  ColumnDef,
  FilterDef,
  PaginatedResponse,
  TableQueryParams,
} from "@shared";
import api from "../../api/client";
import type { ActivityActionOption, ActivityLogRow } from "./types";
import { ActorTypeBadge, OutcomeBadge, formatDateTime, formatDuration } from "./badges";
import ActivityLogDetail from "./ActivityLogDetail";
import AdvancedDeletePanel from "./AdvancedDeletePanel";
import { OUTCOME_OPTIONS } from "./constants";

const ACTOR_TYPE_OPTIONS = [
  { value: "tutor", label: "Tutor" },
  { value: "student", label: "Student" },
];

const TIME_WINDOW_OPTIONS = [
  { value: "1d", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

function windowToStartDate(value: string): string | null {
  const now = new Date();
  switch (value) {
    case "1d":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}

const columns: ColumnDef<ActivityLogRow>[] = [
  {
    key: "ended_at",
    label: "When",
    render: (v) => (
      <span className="text-sm text-gray-700 whitespace-nowrap">
        {formatDateTime(v as string)}
      </span>
    ),
  },
  {
    key: "duration_ms",
    label: "Duration",
    sortable: true,
    render: (v) => (
      <span className="text-xs text-gray-500 whitespace-nowrap">
        {formatDuration(v as number | null)}
      </span>
    ),
  },
  {
    key: "actor_name",
    label: "Who",
    sortable: true,
    render: (_v, row) => (
      <div className="flex items-center gap-2 min-w-0">
        <span className="truncate">{row.actor_name ?? "—"}</span>
        <ActorTypeBadge type={row.actor_type} />
      </div>
    ),
  },
  {
    key: "action",
    label: "Action",
    sortable: true,
    render: (_v, row) => (
      <span className="text-sm text-gray-800">{row.action_label}</span>
    ),
  },
  {
    key: "target",
    label: "Target",
    sortable: false,
    render: (_v, row) => {
      if (!row.target_type && !row.target_id) {
        return <span className="text-gray-400 text-xs">—</span>;
      }
      const idShort = row.target_id ? row.target_id.slice(0, 8) : "";
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          {row.target_type && (
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
              {row.target_type}
            </span>
          )}
          {row.target_name ? (
            <span className="text-xs text-gray-700 truncate">{row.target_name}</span>
          ) : (
            <span className="text-xs text-gray-500 font-mono">{idShort}</span>
          )}
        </div>
      );
    },
  },
  {
    key: "outcome",
    label: "Outcome",
    sortable: true,
    render: (_v, row) => <OutcomeBadge outcome={row.outcome} />,
  },
];

export default function ActivityLogList() {
  const [selected, setSelected] = useState<ActivityLogRow | null>(null);
  const [actionOptions, setActionOptions] = useState<ActivityActionOption[]>([]);
  const [advDeleteOpen, setAdvDeleteOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast, showApiError, dismiss } = useToast();

  useEffect(() => {
    api
      .get<ActivityActionOption[]>("/activity-logs/actions")
      .then(({ data }) => setActionOptions(data))
      .catch((err) => showApiError(err, "Failed to load action filter options."));
  }, [showApiError]);

  const filters: FilterDef[] = useMemo(
    () => [
      { key: "actor_type", label: "Actor", options: ACTOR_TYPE_OPTIONS },
      { key: "action", label: "Action", options: actionOptions },
      { key: "outcome", label: "Outcome", options: OUTCOME_OPTIONS },
      { key: "_window", label: "Time", options: TIME_WINDOW_OPTIONS },
    ],
    [actionOptions]
  );

  const fetchLogs = async (
    params: TableQueryParams
  ): Promise<PaginatedResponse<ActivityLogRow>> => {
    // Translate the synthetic _window filter into start_date
    const { _window, ...rest } = params as TableQueryParams & { _window?: string };
    const queryParams: Record<string, unknown> = { ...rest };
    if (_window) {
      const startDate = windowToStartDate(_window);
      if (startDate) queryParams.start_date = startDate;
    }
    delete queryParams._window;
    const res = await api.get("/activity-logs", { params: queryParams });
    return res.data;
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title="Activity Log"
        subtitle="Every action recorded from the moment this feature was deployed."
      />

      <div className="flex justify-end mb-2">
        <Button
          color="danger"
          variant="outline"
          size="sm"
          onClick={() => setAdvDeleteOpen(true)}
        >
          Advanced Delete
        </Button>
      </div>

      <DataTable<ActivityLogRow>
        key={refreshKey}
        fetchFn={fetchLogs}
        columns={columns}
        filters={filters}
        searchPlaceholder="Search by actor, action, path..."
        defaultSortBy="ended_at"
        defaultSortOrder="desc"
        onRowClick={(row) => setSelected(row)}
        rowKey={(r) => r.id}
        showRefresh
      />

      <ActivityLogDetail row={selected} onClose={() => setSelected(null)} />

      <AdvancedDeletePanel
        open={advDeleteOpen}
        onClose={() => setAdvDeleteOpen(false)}
        onDeleted={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
