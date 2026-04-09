import React, { useState, useCallback, useEffect } from "react";
import { Toast } from "./Toast";

interface NotificationPayload {
  message: string;
  [key: string]: unknown;
}

interface WSEvent {
  type: string;
  payload: NotificationPayload;
}

interface NotificationToastProps {
  on: (eventType: string, handler: (event: WSEvent) => void) => () => void;
}

export function NotificationToast({ on }: NotificationToastProps) {
  const [message, setMessage] = useState<string | null>(null);

  const dismiss = useCallback(() => {
    setMessage(null);
  }, []);

  useEffect(() => {
    return on("notification:created", (event: WSEvent) => {
      setMessage(event.payload.message);
    });
  }, [on]);

  if (!message) return null;

  return (
    <Toast
      message={message}
      type="info"
      onDismiss={dismiss}
      duration={5000}
    />
  );
}
