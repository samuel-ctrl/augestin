import { useEffect, useState } from "react";

interface MediaThumbnailProps {
  src?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  renderPlaceholder: (className: string) => React.ReactNode;
}

export function MediaThumbnail({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  renderPlaceholder,
}: MediaThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  const showImage = !!src && !failed;

  return (
    <div className={`relative overflow-hidden bg-gray-100 dark:bg-gray-700 ${className}`}>
      {renderPlaceholder(
        `absolute inset-0 w-full h-full transition-opacity ${showImage && loaded ? "opacity-0" : "opacity-100"}`
      )}
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
