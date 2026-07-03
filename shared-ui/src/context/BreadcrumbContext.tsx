import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { BreadcrumbSegment } from "../types";

interface BreadcrumbContextValue {
  breadcrumbs: BreadcrumbSegment[];
  setBreadcrumbs: (segments: BreadcrumbSegment[]) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

/**
 * Wraps the app so any page can publish its breadcrumb trail to the persistent
 * top bar. AppLayout renders this internally — portals don't need to add it.
 */
export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([]);
  const value = useMemo(() => ({ breadcrumbs, setBreadcrumbs }), [breadcrumbs]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

/** Read the current breadcrumb trail (used by the layout's top bar). */
export function useBreadcrumbs(): BreadcrumbSegment[] {
  return useContext(BreadcrumbContext)?.breadcrumbs ?? [];
}

/**
 * Publish a breadcrumb trail from a page. The trail shows in the top bar while
 * the page is mounted and clears automatically on unmount. Pass an empty array
 * (e.g. before data loads) to show nothing.
 */
export function useSetBreadcrumbs(segments: BreadcrumbSegment[]): void {
  const ctx = useContext(BreadcrumbContext);
  const serialized = JSON.stringify(segments);
  useEffect(() => {
    if (!ctx) return;
    ctx.setBreadcrumbs(segments);
    return () => ctx.setBreadcrumbs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);
}
