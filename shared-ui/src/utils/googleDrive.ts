const DRIVE_FILE_REGEX = /\/file\/d\/([a-zA-Z0-9_-]+)/;
const DRIVE_ID_PARAM_REGEX = /[?&]id=([a-zA-Z0-9_-]+)/;

export function extractFileId(url: string): string | null {
  const fileMatch = url.match(DRIVE_FILE_REGEX);
  if (fileMatch) return fileMatch[1];

  const paramMatch = url.match(DRIVE_ID_PARAM_REGEX);
  if (paramMatch) return paramMatch[1];

  return null;
}

export function isGoogleDriveUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "drive.google.com" && extractFileId(url) !== null;
  } catch {
    return false;
  }
}

export function toEmbedUrl(url: string): string {
  const fileId = extractFileId(url);
  if (!fileId) return "";
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function toDriveThumbnailUrl(url: string, size = 400): string {
  // Already a thumbnail URL — return as-is so re-resolving never downgrades
  // a caller-chosen size (the id= regex would match thumbnail URLs too).
  if (url.includes("drive.google.com/thumbnail")) return url;
  if (!isGoogleDriveUrl(url)) return url;
  return `https://drive.google.com/thumbnail?id=${extractFileId(url)}&sz=w${size}`;
}
