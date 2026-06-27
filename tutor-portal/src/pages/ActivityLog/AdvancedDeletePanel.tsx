import { useEffect, useState } from "react";
import { Button, ConfirmDialog, Toast, useToast } from "@shared";
import api from "../../api/client";
import { OUTCOME_OPTIONS } from "./constants";

interface AdvancedDeletePanelProps {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

type ConfirmMode = "range" | "outcome" | null;

export default function AdvancedDeletePanel({ open, onClose, onDeleted }: AdvancedDeletePanelProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedOutcomes, setSelectedOutcomes] = useState<Set<string>>(new Set());
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast, showApiError, showSuccess, dismiss } = useToast();

  useEffect(() => {
    if (!open) {
      setStartDate("");
      setEndDate("");
      setSelectedOutcomes(new Set());
      setConfirmMode(null);
    }
  }, [open]);

  const toggleOutcome = (value: string) => {
    setSelectedOutcomes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      if (confirmMode === "range") {
        const body: Record<string, unknown> = {};
        if (startDate) body.start_date = startDate + "T00:00:00.000Z";
        if (endDate) body.end_date = endDate + "T23:59:59.999Z";
        const { data } = await api.post<{ deleted: number }>("/activity-logs/bulk-delete", body);
        showSuccess(`Deleted ${data.deleted} record${data.deleted === 1 ? "" : "s"}.`);
      } else if (confirmMode === "outcome") {
        const { data } = await api.post<{ deleted: number }>("/activity-logs/bulk-delete", {
          outcomes: Array.from(selectedOutcomes),
        });
        showSuccess(`Deleted ${data.deleted} record${data.deleted === 1 ? "" : "s"}.`);
      }
      setConfirmMode(null);
      onDeleted();
    } catch (err) {
      showApiError(err, "Delete failed. Please try again.");
      setConfirmMode(null);
    } finally {
      setDeleting(false);
    }
  };

  const rangeLabel = () => {
    if (startDate && endDate) return `from ${startDate} to ${endDate}`;
    if (startDate) return `from ${startDate} onwards`;
    if (endDate) return `up to ${endDate}`;
    return "in all dates";
  };

  if (!open) return null;

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={deleting ? undefined : onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-96 flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Advanced Delete</h2>
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
            disabled={deleting}
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">
          {/* Section A: Date Range */}
          <section>
            <h3 className="mb-1 text-sm font-semibold text-gray-800">Delete by Date Range</h3>
            <p className="mb-4 text-xs text-gray-500">
              Permanently removes all records where the action ended within the selected dates.
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-200"
                />
              </div>
            </div>
            <div className="mt-4">
              <Button
                color="danger"
                variant="outline"
                fullWidth
                disabled={!startDate && !endDate}
                onClick={() => setConfirmMode("range")}
              >
                Delete Range
              </Button>
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* Section B: By Outcome */}
          <section>
            <h3 className="mb-1 text-sm font-semibold text-gray-800">Delete by Outcome</h3>
            <p className="mb-4 text-xs text-gray-500">
              Permanently removes all records matching the selected outcome statuses.
            </p>
            <div className="space-y-2">
              {OUTCOME_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedOutcomes.has(opt.value)}
                    onChange={() => toggleOutcome(opt.value)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-200"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <Button
                color="danger"
                variant="outline"
                fullWidth
                disabled={selectedOutcomes.size === 0}
                onClick={() => setConfirmMode("outcome")}
              >
                Delete by Outcome
              </Button>
            </div>
          </section>
        </div>
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmMode === "range"}
        title="Delete records by date range?"
        message={`This will permanently delete all activity log records ${rangeLabel()}. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        countdownSeconds={3}
        loading={deleting}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmMode(null)}
      />
      <ConfirmDialog
        open={confirmMode === "outcome"}
        title="Delete records by outcome?"
        message={`This will permanently delete all activity log records with outcome: ${Array.from(selectedOutcomes).join(", ")}. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        countdownSeconds={3}
        loading={deleting}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmMode(null)}
      />
    </>
  );
}
