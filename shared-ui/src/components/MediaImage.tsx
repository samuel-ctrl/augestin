import React, { useState } from "react";
import { isGoogleDriveUrl } from "../utils/googleDrive";
import { resolveMediaUrl } from "../utils/mediaUrls";

interface MediaImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | null | undefined;
  /** Drive thumbnail width (sz=w{size}), default 400. */
  size?: number;
  /** Portal assetUrl — pass when src may be a relative path. */
  resolvePath?: (path: string) => string;
  /** Shown when src is empty or every load attempt fails. */
  fallback?: string;
}

/**
 * Drive-aware <img>: resolves Google Drive share links to thumbnail URLs,
 * retries the original URL if the thumbnail endpoint fails, then falls back
 * to `fallback` or hides entirely.
 */
export function MediaImage({ src, size, resolvePath, fallback, ...imgProps }: MediaImageProps) {
  const [state, setState] = useState({ src, attempt: 0 });
  if (state.src !== src) {
    setState({ src, attempt: 0 });
  }

  const resolved = resolveMediaUrl(src, { size, resolvePath });

  const candidates: string[] = [];
  if (resolved) candidates.push(resolved);
  if (src && src !== resolved && isGoogleDriveUrl(src)) candidates.push(src);
  if (fallback && !candidates.includes(fallback)) candidates.push(fallback);

  const currentSrc = candidates[state.attempt];
  if (!currentSrc) return null;

  return (
    <img
      src={currentSrc}
      onError={() => setState((s) => ({ ...s, attempt: s.attempt + 1 }))}
      {...imgProps}
    />
  );
}
