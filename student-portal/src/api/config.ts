export const API_URL = import.meta.env.VITE_API_URL || "";

export function assetUrl(path: string | undefined | null): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}
