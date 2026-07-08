// Types
export type {
  User,
  Student,
  Subject,
  Book,
  Topic,
  TopicProgress,
  TopicNotes,
  BookRecap,
  Assignment,
  BookProgress,
  ResumeTopicData,
  PaginatedResponse,
  TableQueryParams,
  ColumnDef,
  FilterDef,
  NavItem,
  BreadcrumbSegment,
  Question,
  QuizProgress,
  QuizSession,
  QuizSubmitResponse,
  ReviewQuestion,
  QuizSet,
  QuizSetAssignment,
  AssignedQuizSet,
  QuizSetLeaderboardEntry,
  LiveQuizStatus,
  LiveQuizParticipant,
  LiveQuizLeaderboardEntry,
  LiveQuizAnswer,
  LiveQuizRoomSnapshot,
  LearningZoneQuiz,
  BookTest,
  TestSubmissionStatus,
  TestSet,
  TestSetFile,
  TestSetDetail,
  TestSetAssignment,
  AssignedTestSet,
  Doubt,
  DoubtComment,
  DoubtDetail,
  LookupOption,
  LookupOptions,
} from "./types";

// Constants
export { iconMap, iconKeys } from "./constants/icons";

// Utils
export { extractFileId, isGoogleDriveUrl, toEmbedUrl, toDirectImageUrl } from "./utils/googleDrive";

// Hooks
export { useDebounce } from "./hooks/useDebounce";
export { useServerTable } from "./hooks/useServerTable";
export { useApi } from "./hooks/useApi";
export { useToast, extractErrorMessage } from "./hooks/useToast";
export { useWebSocket } from "./hooks/useWebSocket";
export type { WSEvent, WSStatus } from "./hooks/useWebSocket";

// Layout Components
export { AppLayout } from "./components/AppLayout";
export { Sidebar } from "./components/Sidebar";
export { Breadcrumb } from "./components/Breadcrumb";
export { useSetBreadcrumbs, useBreadcrumbs, BreadcrumbProvider } from "./context/BreadcrumbContext";
export { ProtectedRoute } from "./components/ProtectedRoute";

// DataTable
export { DataTable } from "./components/DataTable/DataTable";
export { TableSearch } from "./components/DataTable/TableSearch";
export { TableFilters } from "./components/DataTable/TableFilters";
export { TableSortHeader } from "./components/DataTable/TableSortHeader";
export { TablePagination } from "./components/DataTable/TablePagination";

// UI Primitives
export { PageHeader } from "./components/PageHeader";
export { Card } from "./components/Card";
export { Button } from "./components/Button";
export { LoadingSpinner } from "./components/LoadingSpinner";
export { ErrorToast } from "./components/ErrorToast";
export { Toast } from "./components/Toast";
export type { ToastType } from "./components/Toast";
export { EmptyState } from "./components/EmptyState";
export { ConfirmDialog } from "./components/ConfirmDialog";
export { FormDialog } from "./components/FormDialog";
export { NotificationBell } from "./components/NotificationBell";
export { NotificationToast } from "./components/NotificationToast";
export { NotificationsPage } from "./components/NotificationsPage";
export { AlertCard } from "./components/AlertCard";
export type { AlertCardVariant } from "./components/AlertCard";
export { ProgressBar } from "./components/ProgressBar";
export { LiveLeaderboard } from "./components/LiveLeaderboard";
export { DropdownMenu } from "./components/DropdownMenu";
export type { DropdownMenuItem } from "./components/DropdownMenu";

// Content Components
export { SubjectCard } from "./components/SubjectCard";
export { SubjectTile } from "./components/SubjectTile";
export { BookCard } from "./components/BookCard";
export { BookThumbnail, BookPlaceholderIcon } from "./components/BookThumbnail";
export { QuizThumbnail, QuizPlaceholderIcon } from "./components/QuizThumbnail";
export { AttachmentGallery } from "./components/AttachmentGallery";
export { VideoPlayer } from "./components/VideoPlayer";
export { IconPicker } from "./components/IconPicker";
export { FileUpload } from "./components/FileUpload";
export { CredentialCard } from "./components/CredentialCard";
export { MathText } from "./components/MathText";
export { default as RecapViewer, toDirectImageUrl as toDirectRecapImageUrl } from "./components/RecapViewer";
export { default as RecapEditor } from "./components/RecapEditor";
export { BrandCredit, DEVELOPER_NAME, PORTFOLIO_URL, LINKEDIN_URL } from "./components/BrandCredit";
export { AuthStatusPage } from "./components/AuthStatusPage";
