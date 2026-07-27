const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTNAMES = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const YOUTUBE_PATH_PREFIXES = ["/shorts/", "/embed/", "/live/", "/v/"];

export function getYouTubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  let candidate: string | null = null;

  if (parsed.hostname === "youtu.be") {
    candidate = parsed.pathname.split("/")[1] ?? null;
  } else if (YOUTUBE_HOSTNAMES.has(parsed.hostname)) {
    candidate = parsed.searchParams.get("v");
    if (!candidate) {
      const prefix = YOUTUBE_PATH_PREFIXES.find((p) => parsed.pathname.startsWith(p));
      if (prefix) {
        candidate = parsed.pathname.slice(prefix.length).split("/")[0];
      }
    }
  }

  return candidate && YOUTUBE_ID_REGEX.test(candidate) ? candidate : null;
}

export function isYouTubeUrl(url: string): boolean {
  return getYouTubeId(url) !== null;
}

export function toYouTubeEmbedUrl(url: string): string {
  const id = getYouTubeId(url);
  if (!id) return "";

  let embedUrl = `https://www.youtube-nocookie.com/embed/${id}?rel=0`;

  // Carry over a start timestamp (?t=90 / ?t=90s / ?start=90) if present.
  try {
    const parsed = new URL(url);
    const t = parsed.searchParams.get("t") || parsed.searchParams.get("start");
    if (t) {
      const seconds = parseInt(t, 10);
      if (Number.isFinite(seconds) && seconds > 0) {
        embedUrl += `&start=${seconds}`;
      }
    }
  } catch {
    // unreachable: getYouTubeId already parsed the URL
  }

  return embedUrl;
}
