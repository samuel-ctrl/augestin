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
  section?: string;
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
  standard: string;
  subject_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  question_count?: number;
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

export interface Question {
  id: string;
  book_id?: string;
  quiz_set_id?: string;
  question_text: string;
  question_image_url?: string;
  option_a: string;
  option_a_image_url?: string;
  option_b: string;
  option_b_image_url?: string;
  option_c: string;
  option_c_image_url?: string;
  option_d: string;
  option_d_image_url?: string;
  correct_option?: string;
  explanation?: string;
  time_limit_seconds: number;
  created_at?: string;
}

export interface QuizProgress {
  correct_count: number;
  skipped_count: number;
  total_attempted: number;
  total_questions: number;
  current_question_index: number;
  is_started: boolean;
  is_completed: boolean;
  started_at?: string;
  completed_at?: string;
  score_percentage: number;
  total_time_seconds: number;
}

export interface ReviewQuestion {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation?: string;
  selected_option?: string;
  is_correct: boolean;
}

export interface QuizSession {
  questions: Question[];
  total_questions: number;
  total_time_seconds: number;
  progress: QuizProgress | null;
  answers: Record<string, string>;
  skipped: Record<string, boolean>;
  review?: ReviewQuestion[];
}

export interface QuizSubmitResponse {
  is_correct: boolean;
  is_skipped: boolean;
  correct_option: string;
  explanation?: string;
  progress: QuizProgress;
}

export interface Recap {
  id: string;
  book_id: string;
  created_by: string;
  title: string;
  content: any;
  created_at: string;
  updated_at: string;
}

export interface QuizSet {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  created_by: string;
  question_count: number;
  created_at: string;
  updated_at?: string;
}

export interface QuizSetAssignment {
  id: string;
  quiz_set_id: string;
  student_id: string;
  student_name: string;
  student_login_id: string;
  created_at: string;
}

export interface AssignedQuizSet {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  question_count: number;
  progress?: QuizProgress;
}

export interface BookTest {
  id: string;
  book_id: string;
  drive_link: string;
  instructions?: string;
  created_at: string;
  updated_at?: string;
}

export interface TestSubmissionStatus {
  has_submitted: boolean;
  submitted_at?: string;
}

// ============================================================================
// Test Sets (Standalone)
// ============================================================================

export interface TestSet {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  created_by: string;
  file_count: number;
  created_at: string;
  updated_at?: string;
}

export interface TestSetFile {
  id: string;
  test_set_id: string;
  file_name: string;
  drive_link: string;
  instructions?: string;
  created_at: string;
  updated_at?: string;
}

export interface TestSetDetail extends TestSet {
  files: TestSetFile[];
}

export interface TestSetAssignment {
  id: string;
  test_set_id: string;
  student_id: string;
  student_name: string;
  student_login_id: string;
  created_at: string;
}

export interface AssignedTestSet {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  file_count: number;
  files: TestSetFile[];
  submission_status?: { has_submitted: boolean; submitted_at?: string };
}

// ============================================================================
// Doubts
// ============================================================================

export interface Doubt {
  id: string;
  title: string;
  description: string;
  status: "open" | "resolved" | "closed";
  student_id: string;
  student_name: string;
  book_id?: string;
  book_title?: string;
  attachment_links?: string[];
  comment_count: number;
  created_at: string;
  updated_at?: string;
}

export interface DoubtComment {
  id: string;
  doubt_id: string;
  user_id: string;
  user_name: string;
  user_type: "student" | "tutor";
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface DoubtDetail extends Doubt {
  comments: DoubtComment[];
}
