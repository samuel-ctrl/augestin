// Types
export type {
  User,
  Student,
  Subject,
  Book,
  Assignment,
  BookProgress,
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
  Recap,
  QuizSet,
  QuizSetAssignment,
  AssignedQuizSet,
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
} from "./types";

// Constants
export { iconMap, iconKeys, standardOptions } from "./constants/icons";

// Utils
export { extractFileId, isGoogleDriveUrl, toEmbedUrl, toDirectImageUrl } from "./utils/googleDrive";

// Hooks
export { useDebounce } from "./hooks/useDebounce";
export { useServerTable } from "./hooks/useServerTable";
export { useApi } from "./hooks/useApi";
export { useToast, extractErrorMessage } from "./hooks/useToast";

// Layout Components
export { AppLayout } from "./components/AppLayout";
export { Sidebar } from "./components/Sidebar";
export { Breadcrumb } from "./components/Breadcrumb";
export { ProtectedRoute } from "./components/ProtectedRoute";

// DataTable
export { DataTable } from "./components/DataTable/DataTable";
export { TableSearch } from "./components/DataTable/TableSearch";
export { TableFilters } from "./components/DataTable/TableFilters";
export { TableSortHeader } from "./components/DataTable/TableSortHeader";
export { TablePagination } from "./components/DataTable/TablePagination";

// UI Primitives
export { PageHeader } from "./components/PageHeader";
export { Button } from "./components/Button";
export { LoadingSpinner } from "./components/LoadingSpinner";
export { ErrorToast } from "./components/ErrorToast";
export { Toast } from "./components/Toast";
export type { ToastType } from "./components/Toast";
export { EmptyState } from "./components/EmptyState";
export { ConfirmDialog } from "./components/ConfirmDialog";
export { AlertCard } from "./components/AlertCard";
export type { AlertCardVariant } from "./components/AlertCard";
export { ProgressBar } from "./components/ProgressBar";

// Content Components
export { SubjectCard } from "./components/SubjectCard";
export { SubjectTile } from "./components/SubjectTile";
export { BookCard } from "./components/BookCard";
export { AttachmentGallery } from "./components/AttachmentGallery";
export { VideoPlayer } from "./components/VideoPlayer";
export { IconPicker } from "./components/IconPicker";
export { FileUpload } from "./components/FileUpload";
export { CredentialCard } from "./components/CredentialCard";
export { MathText } from "./components/MathText";
export { default as RecapViewer } from "./components/RecapViewer";
