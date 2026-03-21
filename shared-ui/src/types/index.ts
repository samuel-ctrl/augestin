export interface User {
  id: string;
  login_id: string;
  name: string;
  email?: string;
  phone?: string;
  user_type: "student" | "tutor";
  standard?: string;
  must_change_password: boolean;
}

export interface Student {
  id: string;
  login_id: string;
  name: string;
  email?: string;
  phone?: string;
  standard?: string;
  must_change_password: boolean;
  assignment_count: number;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  created_by: string;
  book_count: number;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  video_url: string;
  video_duration_seconds?: number;
  standard: string;
  sort_order: number;
  subject_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  watch_percentage?: number;
  last_position_seconds?: number;
  completed?: boolean;
}

export interface Assignment {
  id: string;
  book_id: string;
  student_id: string;
  student_name: string;
  student_login_id: string;
  assigned_by: string;
  assigned_at: string;
}

export interface BookProgress {
  book_id: string;
  book_title: string;
  subject_id: string;
  watch_percentage: number;
  last_position_seconds: number;
  completed: boolean;
  last_watched_at?: string;
}

export interface ResumeBook {
  book_id: string;
  book_title: string;
  subject_id: string;
  subject_name: string;
  thumbnail_url?: string;
  watch_percentage: number;
  last_position_seconds: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TableQueryParams {
  page: number;
  page_size: number;
  search: string;
  sort_by: string;
  sort_order: "asc" | "desc";
  [filterKey: string]: string | number;
}

export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
}

export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export interface BreadcrumbSegment {
  label: string;
  path?: string;
}
