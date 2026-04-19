import type { ActivityLogRow } from "./types";
import { OutcomeBadge, ActorTypeBadge, formatDateTime, formatDuration } from "./badges";

interface Props {
  row: ActivityLogRow | null;
  onClose: () => void;
}

export default function ActivityLogDetail({ row, onClose }: Props) {
  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {row.action_label}
            </h3>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{row.action}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <Section title="Outcome">
            <Grid>
              <Field label="Outcome"><OutcomeBadge outcome={row.outcome} /></Field>
              <Field label="Status Code">{row.status_code ?? "—"}</Field>
              {row.error_message && (
                <div className="col-span-2">
                  <FieldLabel>Error Message</FieldLabel>
                  <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded p-2 mt-1 whitespace-pre-wrap break-words">
                    {row.error_message}
                  </p>
                </div>
              )}
            </Grid>
          </Section>

          <Section title="Timing">
            <Grid>
              <Field label="Started At">{formatDateTime(row.started_at)}</Field>
              <Field label="Ended At">{formatDateTime(row.ended_at)}</Field>
              <Field label="Duration">{formatDuration(row.duration_ms)}</Field>
            </Grid>
          </Section>

          <Section title="Actor">
            <Grid>
              <Field label="Name">{row.actor_name ?? "—"}</Field>
              <Field label="Type"><ActorTypeBadge type={row.actor_type} /></Field>
              <Field label="User ID">
                <span className="font-mono text-xs break-all">{row.actor_id ?? "—"}</span>
              </Field>
            </Grid>
          </Section>

          <Section title="Request">
            <Grid>
              <Field label="Method">
                <span className="font-mono text-xs px-2 py-0.5 bg-gray-100 rounded">{row.method}</span>
              </Field>
              <Field label="Path">
                <span className="font-mono text-xs break-all">{row.path}</span>
              </Field>
              <Field label="IP Address">{row.ip_address ?? "—"}</Field>
              <Field label="Request ID">
                <span className="font-mono text-xs break-all">{row.request_id ?? "—"}</span>
              </Field>
              {row.user_agent && (
                <div className="col-span-2">
                  <FieldLabel>User Agent</FieldLabel>
                  <p className="text-xs text-gray-600 break-all mt-1">{row.user_agent}</p>
                </div>
              )}
            </Grid>
          </Section>

          {(row.target_type || row.target_id || row.target_name) && (
            <Section title="Target">
              <Grid>
                <Field label="Type">{row.target_type ?? "—"}</Field>
                <Field label="Name">{row.target_name ?? "—"}</Field>
                <Field label="ID">
                  <span className="font-mono text-xs break-all">{row.target_id ?? "—"}</span>
                </Field>
              </Grid>
            </Section>
          )}

          {row.meta && Object.keys(row.meta).length > 0 && (
            <Section title="Metadata (what was submitted / context)">
              <pre className="text-xs bg-gray-900 text-gray-100 rounded p-3 overflow-auto max-h-72 font-mono whitespace-pre-wrap break-words">
                {JSON.stringify(row.meta, null, 2)}
              </pre>
            </Section>
          )}

          <div className="pt-2 border-t border-gray-100">
            <FieldLabel>Log Entry ID</FieldLabel>
            <p className="font-mono text-xs text-gray-500 break-all mt-1">{row.id}</p>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="text-sm text-gray-800 mt-0.5">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-gray-500">{children}</div>;
}
