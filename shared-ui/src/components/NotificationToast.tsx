import React, { useState, useCallback, useEffect } from "react";
import { Toast } from "./Toast";
import type { WSEvent } from "../hooks/useWebSocket";

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
      setMessage((event.payload as { message?: string }).message ?? null);
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
