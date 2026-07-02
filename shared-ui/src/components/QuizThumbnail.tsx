import { MediaThumbnail } from "./MediaThumbnail";

export function QuizPlaceholderIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 200"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <rect width="300" height="200" fill="#f3f4f6" />
      <rect x="90" y="35" width="120" height="170" rx="10" fill="#ffffff" stroke="#cbd5e1" strokeWidth="3" />
      <rect x="104" y="55" width="92" height="10" rx="4" fill="#cbd5e1" />
      <rect x="104" y="70" width="60" height="8" rx="4" fill="#e2e8f0" />

      <circle cx="112" cy="102" r="8" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
      <rect x="128" y="98" width="68" height="8" rx="4" fill="#e2e8f0" />

      <circle cx="112" cy="132" r="8" fill="#3b82f6" />
      <path d="M108 132l3 3 6-7" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="128" y="128" width="68" height="8" rx="4" fill="#e2e8f0" />

      <circle cx="112" cy="162" r="8" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
      <rect x="128" y="158" width="50" height="8" rx="4" fill="#e2e8f0" />
    </svg>
  );
}

interface QuizThumbnailProps {
  src?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
}

export function QuizThumbnail(props: QuizThumbnailProps) {
  return <MediaThumbnail {...props} renderPlaceholder={(cn) => <QuizPlaceholderIcon className={cn} />} />;
}
