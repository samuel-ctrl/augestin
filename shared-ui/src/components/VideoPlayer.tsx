import React, { useRef, useEffect, useCallback } from "react";

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
