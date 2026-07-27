import React, { useState } from "react";
import { isGoogleDriveUrl, toDriveThumbnailUrl } from "../utils/googleDrive";

interface AttachmentGalleryProps {
  links: string[];
}

function getPreviewUrl(url: string): string | null {
  if (isGoogleDriveUrl(url)) {
    return toDriveThumbnailUrl(url, 400);
  }
  // For non-Drive URLs, try showing directly if it looks like an image
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)) {
    return url;
  }
  return null;
}

function getFullImageUrl(url: string): string {
  return toDriveThumbnailUrl(url, 1600);
}

export function AttachmentGallery({ links }: AttachmentGalleryProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!links || links.length === 0) return null;

  return (
    <>
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Attachments</h3>
        <div className="flex flex-wrap gap-3">
          {links.map((link, idx) => {
            const previewUrl = getPreviewUrl(link);

            if (previewUrl) {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setLightboxUrl(getFullImageUrl(link))}
                  className="group relative w-28 h-28 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-700 hover:border-primary-400 hover:shadow-md transition-all"
                >
                  <img
                    src={previewUrl}
                    alt={`Attachment ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback: hide image and show link icon
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                  <div className="hidden flex-col items-center justify-center w-full h-full text-gray-400">
                    <span className="text-2xl">📎</span>
                    <span className="text-[10px] mt-1">View</span>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs bg-black/50 px-2 py-1 rounded">
                      Click to view
                    </span>
                  </div>
                </button>
              );
            }

            // Non-image link: show as a plain link
            return (
              <a
                key={idx}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 hover:underline"
              >
                <span>📎</span>
                <span className="truncate max-w-xs">{link}</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 z-50"
          >
            &times;
          </button>
          <img
            src={lightboxUrl}
            alt="Attachment preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
