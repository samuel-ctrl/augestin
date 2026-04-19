export type ActivityOutcome =
  | "success"
  | "client_error"
  | "server_error"
  | "exception";

export interface ActivityLogRow {
  id: string;
  started_at: string;
  ended_at: string;
  duration_ms: number | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_type: "tutor" | "student" | null;
  action: string;
  action_label: string;
  method: string;
  path: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  status_code: number | null;
  outcome: ActivityOutcome | null;
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  meta: Record<string, unknown> | null;
}

export interface ActivityActionOption {
  value: string;
  label: string;
}
