import { isGoogleDriveUrl, toDriveThumbnailUrl } from "./googleDrive";

export interface ResolveMediaUrlOptions {
  /** Drive thumbnail width (sz=w{size}), default 400. */
  size?: number;
  /** Portal assetUrl — applied to non-Drive URLs so relative paths resolve. */
  resolvePath?: (path: string) => string;
  /** Returned when the input URL is null/empty. */
  fallback?: string;
}

export function resolveMediaUrl(
  url: string | null | undefined,
  opts: ResolveMediaUrlOptions = {}
): string | undefined {
  const { size = 400, resolvePath, fallback } = opts;
  if (!url) return fallback;
  if (isGoogleDriveUrl(url)) return toDriveThumbnailUrl(url, size);
  return resolvePath ? resolvePath(url) : url;
}
