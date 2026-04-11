import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useWebSocket } from "@shared";
import type { WSEvent, WSStatus } from "@shared";
import { useAuth } from "./AuthContext";
import { API_URL } from "../api/config";

type EventHandler = (event: WSEvent) => void;

interface WSContextType {
  on: (eventType: string, handler: EventHandler) => () => void;
  status: WSStatus;
}

const WSContext = createContext<WSContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const { on, status } = useWebSocket(API_URL, token);

  return <WSContext.Provider value={{ on, status }}>{children}</WSContext.Provider>;
}

export function useWS() {
  const ctx = useContext(WSContext);
  if (!ctx) throw new Error("useWS must be used within WebSocketProvider");
  return ctx;
}
