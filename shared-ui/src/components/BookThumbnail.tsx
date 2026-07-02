import { useEffect, useState } from "react";

export function BookPlaceholderIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 200"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <rect width="300" height="200" fill="#f3f4f6" />
      <rect x="90" y="40" width="120" height="160" rx="8" fill="#cbd5e1" />
      <line x1="150" y1="48" x2="150" y2="192" stroke="#94a3b8" strokeWidth="3" />
      <rect x="130" y="40" width="16" height="46" fill="#60a5fa" />
      <line x1="164" y1="80" x2="192" y2="80" stroke="#f8fafc" strokeWidth="5" strokeLinecap="round" />
      <line x1="164" y1="100" x2="192" y2="100" stroke="#f8fafc" strokeWidth="5" strokeLinecap="round" />
      <line x1="164" y1="120" x2="184" y2="120" stroke="#f8fafc" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

interface BookThumbnailProps {
  src?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
}

export function BookThumbnail({ src, alt = "", className = "", imgClassName = "" }: BookThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  const showImage = !!src && !failed;

  return (
    <div className={`relative overflow-hidden bg-gray-100 dark:bg-gray-700 ${className}`}>
      <BookPlaceholderIcon
        className={`absolute inset-0 w-full h-full transition-opacity ${
          showImage && loaded ? "opacity-0" : "opacity-100"
        }`}
      />
      {showImage && (
        <img
          src={src}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
            loaded ? "opacity-100" : "opacity-0"
          } ${imgClassName}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
