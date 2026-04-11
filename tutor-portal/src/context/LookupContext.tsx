import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import type { LookupOption } from "@shared";
import api from "../api/client";
import { useAuth } from "./AuthContext";

interface LookupContextType {
  standards: LookupOption[];
  sections: LookupOption[];
  loading: boolean;
  refetch: () => Promise<void>;
}

const LookupContext = createContext<LookupContextType | null>(null);

function loadCached(key: string): LookupOption[] {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function LookupProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [standards, setStandards] = useState<LookupOption[]>(() => loadCached("lookup_standards"));
  const [sections, setSections] = useState<LookupOption[]>(() => loadCached("lookup_sections"));
  const [loading, setLoading] = useState(false);

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/lookups/options");
      setStandards(res.data.standards);
      setSections(res.data.sections);
      localStorage.setItem("lookup_standards", JSON.stringify(res.data.standards));
      localStorage.setItem("lookup_sections", JSON.stringify(res.data.sections));
    } catch {
      // Silently fail — cached or empty dropdowns remain
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOptions();
    } else {
      // Clear cache on logout
      setStandards([]);
      setSections([]);
      localStorage.removeItem("lookup_standards");
      localStorage.removeItem("lookup_sections");
    }
  }, [isAuthenticated, fetchOptions]);

  return (
    <LookupContext.Provider value={{ standards, sections, loading, refetch: fetchOptions }}>
      {children}
    </LookupContext.Provider>
  );
}

export function useLookups() {
  const context = useContext(LookupContext);
  if (!context) {
    throw new Error("useLookups must be used within a LookupProvider");
  }
  return context;
}
