import React from "react";
import { Button } from "./Button";

interface FormDialogProps {
  open: boolean;
  title: string;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  /** Disable submit button (e.g. when form is invalid) */
  submitDisabled?: boolean;
  children: React.ReactNode;
}

export function FormDialog({
  open,
  title,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  loading = false,
  submitDisabled = false,
  children,
}: FormDialogProps) {
  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={loading ? undefined : onCancel} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <form onSubmit={handleSubmit}>
          <div className="px-6 pt-6 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">{title}</h3>
            {children}
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" color="secondary" onClick={onCancel} disabled={loading} type="button">
              {cancelLabel}
            </Button>
            <Button type="submit" loading={loading} disabled={submitDisabled}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
