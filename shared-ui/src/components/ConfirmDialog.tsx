import React, { useState, useEffect } from "react";
import { Button } from "./Button";
import { AlertCard } from "./AlertCard";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
  countdownSeconds?: number;
  alertMessage?: string;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  countdownSeconds,
  alertMessage,
}: ConfirmDialogProps) {
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!open || !countdownSeconds) {
      setCountdown(0);
      return;
    }
    setCountdown(countdownSeconds);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [open, countdownSeconds]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        {alertMessage && (
          <AlertCard
            variant={variant === "danger" ? "danger" : "warning"}
            message={alertMessage}
            className="mb-4"
          />
        )}
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" color="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            color={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={countdown > 0}
          >
            {countdown > 0 ? `${confirmLabel} (${countdown})` : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
