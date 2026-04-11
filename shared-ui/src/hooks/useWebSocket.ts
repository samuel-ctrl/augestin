import { useEffect, useRef, useCallback, useState } from "react";

export interface WSEvent {
  type: string;
  payload: Record<string, unknown>;
}

export type WSStatus = "connected" | "connecting" | "disconnected";

type EventHandler = (event: WSEvent) => void;

export function useWebSocket(apiUrl: string, token: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptRef = useRef(0);
  const [status, setStatus] = useState<WSStatus>("disconnected");
  const MAX_RECONNECT_DELAY = 30_000;

  const getWsUrl = useCallback(() => {
    if (apiUrl) {
      // Production / explicit API URL: convert http(s) -> ws(s)
      return apiUrl.replace(/^http/, "ws") + "/ws";
    }
    // Dev proxy mode: derive from current page location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }, [apiUrl]);

  const connect = useCallback(() => {
    if (!token) return;

    // Prevent duplicate connections from pending reconnect timers
    clearTimeout(reconnectTimeoutRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const url = `${getWsUrl()}?token=${token}`;
    setStatus("connecting");
    const ws = new WebSocket(url);

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const data: WSEvent = JSON.parse(event.data);
        const handlers = handlersRef.current.get(data.type);
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onclose = (event) => {
      wsRef.current = null;
      setStatus("disconnected");
      // Don't reconnect on auth failure
      if (event.code === 1008) return;
      // Exponential backoff: 1s, 2s, 4s, 8s... capped at 30s
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttemptRef.current),
        MAX_RECONNECT_DELAY,
      );
      reconnectAttemptRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [getWsUrl, token]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      // Nullify onclose before closing to prevent reconnect on intentional cleanup
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const on = useCallback((eventType: string, handler: EventHandler) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    handlersRef.current.get(eventType)!.add(handler);

    return () => {
      handlersRef.current.get(eventType)?.delete(handler);
    };
  }, []);

  return { on, status };
}
