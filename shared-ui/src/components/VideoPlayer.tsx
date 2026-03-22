import React, { useRef, useEffect, useCallback, useState } from "react";
import { isGoogleDriveUrl, toEmbedUrl } from "../utils/googleDrive";

interface VideoPlayerProps {
  src: string;
  startPosition?: number;
  onProgress?: (data: { watchPercentage: number; lastPositionSeconds: number }) => void;
  progressInterval?: number;
}

export function VideoPlayer({
  src,
  startPosition = 0,
  onProgress,
  progressInterval = 10000,
}: VideoPlayerProps) {
  if (isGoogleDriveUrl(src)) {
    return <DriveVideoPlayer src={src} />;
  }

  return <NativeVideoPlayer src={src} startPosition={startPosition} onProgress={onProgress} progressInterval={progressInterval} />;
}

function DriveVideoPlayer({ src }: { src: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const embedUrl = toEmbedUrl(src);

  useEffect(() => {
    // Reset status when src changes
    setStatus("loading");
    // Timeout fallback: if iframe hasn't loaded in 15s, show error
    const timer = setTimeout(() => {
      setStatus((prev) => (prev === "loading" ? "error" : prev));
    }, 15000);
    return () => clearTimeout(timer);
  }, [src]);

  if (!embedUrl) {
    return (
      <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
        <p className="text-sm text-gray-500">Invalid video URL</p>
      </div>
    );
  }

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-300">Loading video...</p>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center px-4">
            <p className="text-sm text-gray-600 font-medium">Video unavailable</p>
            <p className="text-xs text-gray-400 mt-1">
              Check that the file is shared as "Anyone with the link can view".
            </p>
          </div>
        </div>
      )}
      <iframe
        src={embedUrl}
        className="w-full aspect-video"
        allow="autoplay; encrypted-media"
        allowFullScreen
        sandbox="allow-same-origin allow-scripts"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </div>
  );
}

function NativeVideoPlayer({
  src,
  startPosition = 0,
  onProgress,
  progressInterval = 10000,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastReportRef = useRef(0);
  const hasSeenRef = useRef(false);

  // Auto-resume on load
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => {
      if (startPosition > 0 && !hasSeenRef.current) {
        video.currentTime = startPosition;
        hasSeenRef.current = true;
      }
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    return () => video.removeEventListener("loadedmetadata", handleLoaded);
  }, [startPosition]);

  // Progress reporting
  const reportProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !onProgress || video.duration === 0) return;

    const percentage = (video.currentTime / video.duration) * 100;
    onProgress({
      watchPercentage: Math.min(100, Math.round(percentage * 100) / 100),
      lastPositionSeconds: video.currentTime,
    });
  }, [onProgress]);

  useEffect(() => {
    if (!onProgress) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        const now = Date.now();
        if (lastReportRef.current === 0 || now - lastReportRef.current >= progressInterval) {
          lastReportRef.current = now;
          reportProgress();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [onProgress, progressInterval, reportProgress]);

  // Report on pause/ended
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onProgress) return;

    const handlePauseOrEnd = () => reportProgress();

    video.addEventListener("pause", handlePauseOrEnd);
    video.addEventListener("ended", handlePauseOrEnd);
    return () => {
      video.removeEventListener("pause", handlePauseOrEnd);
      video.removeEventListener("ended", handlePauseOrEnd);
    };
  }, [onProgress, reportProgress]);

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        src={src}
        controls
        className="w-full aspect-video"
        controlsList="nodownload"
      />
    </div>
  );
}
