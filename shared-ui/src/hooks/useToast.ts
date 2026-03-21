import { useState, useCallback } from "react";
import type { ToastType } from "../components/Toast";

interface ToastState {
  message: string;
  type: ToastType;
}

/** Maps common API error detail strings to user-friendly messages. */
const ERROR_MESSAGE_MAP: Record<string, string> = {
  "Invalid credentials": "Incorrect login ID or password. Please try again.",
  "Invalid or expired token": "Your session has expired. Please log in again.",
  "Tutor access required": "You don't have permission to perform this action.",
  "Student access required": "This feature is only available for students.",
  "Student not found": "The student you're looking for doesn't exist or was deleted.",
  "Subject not found": "The subject you're looking for doesn't exist or was deleted.",
  "Book not found": "The book you're looking for doesn't exist or was deleted.",
  "Book not assigned to you": "This book hasn't been assigned to you yet.",
  "Assignment not found": "The assignment doesn't exist or was already removed.",
  "Incorrect old password": "The current password you entered is incorrect.",
  "Book is not assigned to this student": "This book hasn't been assigned to the student.",
};

/** Extract a user-friendly error message from an API error. */
export function extractErrorMessage(err: unknown, fallback: string): string {
  const detail =
    (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;

  if (detail) {
    // Check if we have a friendly mapping
    if (ERROR_MESSAGE_MAP[detail]) {
      return ERROR_MESSAGE_MAP[detail];
    }

    // Handle common patterns
    if (detail.includes("already exists")) {
      return detail; // Already user-friendly: "A student with email 'x' already exists"
    }
    if (detail.includes("Invalid standard")) {
      return "The selected standard is not valid. Please choose a standard between 1 and 12.";
    }
    if (detail.includes("Invalid icon")) {
      return "The selected icon is not valid. Please choose a different icon.";
    }
    if (detail.includes("Invalid video format")) {
      return "Unsupported video format. Please upload an MP4, WebM, or MOV file.";
    }
    if (detail.includes("Invalid thumbnail format")) {
      return "Unsupported image format. Please upload a JPG, PNG, or WebP file.";
    }
    if (detail.includes("exceeds") && detail.includes("limit")) {
      return detail; // Already user-friendly: "Video exceeds 500MB limit"
    }

    return detail;
  }

  // Check for network/status errors
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403) return "You don't have permission to perform this action.";
  if (status === 404) return "The requested resource was not found.";
  if (status === 409) return "This action conflicts with existing data. Please check for duplicates.";
  if (status === 413) return "The file you're trying to upload is too large.";
  if (status && status >= 500) return "Something went wrong on our end. Please try again later.";

  // Network error (no response)
  const message = (err as { message?: string })?.message;
  if (message === "Network Error") return "Unable to connect to the server. Please check your internet connection.";

  return fallback;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showError = useCallback((message: string) => {
    setToast({ message, type: "error" });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setToast({ message, type: "success" });
  }, []);

  const showInfo = useCallback((message: string) => {
    setToast({ message, type: "info" });
  }, []);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  /** Show a friendly error from an API error response. */
  const showApiError = useCallback((err: unknown, fallback: string) => {
    setToast({ message: extractErrorMessage(err, fallback), type: "error" });
  }, []);

  return { toast, showError, showSuccess, showInfo, showApiError, dismiss };
}
