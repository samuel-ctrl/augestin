import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import type { User } from "@shared";
import api from "../api/client";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("token")
  );

  const isAuthenticated = !!token && !!user;

  const login = useCallback(async (loginId: string, password: string) => {
    const res = await api.post("/auth/login", {
      login_id: loginId,
      password,
    });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.get("/auth/me");
    setUser(res.data);
    localStorage.setItem("user", JSON.stringify(res.data));
  }, []);

  useEffect(() => {
    if (token && !user) {
      refreshUser().catch(() => logout());
    }
  }, [token, user, refreshUser, logout]);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
