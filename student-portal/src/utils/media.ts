import { resolveMediaUrl } from "@shared";
import { assetUrl } from "../api/config";

export function resolveThumbnailUrl(url: string | null | undefined, size?: number): string | undefined {
  return resolveMediaUrl(url, { size, resolvePath: assetUrl });
}
