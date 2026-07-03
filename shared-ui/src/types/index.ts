export interface User {
  id: string;
  login_id: string;
  name: string;
  email?: string;
  phone?: string;
  user_type: "student" | "tutor";
  standard?: string;
  section?: string;
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
  standard: string;
  subject_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  topic_count?: number;
}

export interface Topic {
  id: string;
  book_id: string;
  title: string;
  position: number;
  video_url?: string;
  image_url?: string;
  has_notes: boolean;
  question_count: number;
  created_at: string;
  updated_at?: string;
}

export interface TopicProgress {
  topic_id: string;
  topic_title: string;
  position: number;
  has_video: boolean;
  has_image: boolean;
  image_url?: string | null;
  is_unlocked: boolean;
  is_complete: boolean;
  video_complete: boolean;
  quiz_complete: boolean;
  question_count: number;
  score_percentage?: number | null;
}

export interface TopicNotes {
  id: string;
  topic_id: string;
  title: string;
  content: any;
  created_by?: string;
  created_at: string;
  updated_at?: string;
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
  total_topics: number;
  completed_topics: number;
  last_watched_at?: string;
}

export interface ResumeTopicData {
  topic_id: string;
  topic_title: string;
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

export interface Question {
  id: string;
  topic_id?: string;
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

export type LiveQuizStatus = "lobby" | "active" | "finished";

export interface LiveQuizParticipant {
  user_id: string;
  name: string;
  role: "host" | "player";
  joined_at: string;
  connected: boolean;
  finished: boolean;
}

export interface LiveQuizLeaderboardEntry {
  user_id: string;
  name: string;
  rank: number;
  answered_count: number;
  finished: boolean;
  connected: boolean;
  correct_count?: number;
  score_percentage?: number;
  total_questions?: number;
  time_taken_seconds?: number;
}

export interface LiveQuizAnswer {
  selected_option: string | null;
  is_skipped: boolean;
  is_correct?: boolean;
}

export interface LearningZoneQuiz {
  book_id: string;
  book_title: string;
  book_thumbnail_url?: string;
  subject_id: string;
  subject_name: string;
  question_count: number;
  is_quiz_unlocked: boolean;
}

export interface LiveQuizRoomSnapshot {
  code: string;
  quiz_source: "quiz_set" | "topic";
  quiz_set_id: string | null;
  quiz_set_name: string | null;
  topic_id: string | null;
  topic_title: string | null;
  quiz_name: string;
  host_id: string;
  host_type: "tutor" | "student";
  status: LiveQuizStatus;
  total_time_seconds: number;
  started_at: string | null;
  questions: Question[];
  participants: LiveQuizParticipant[];
  leaderboard: LiveQuizLeaderboardEntry[];
  your_answers: Record<string, LiveQuizAnswer>;
  you_finished: boolean;
  you_role: "host" | "player" | null;
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

export interface QuizSetLeaderboardEntry {
  student_id: string;
  student_name: string;
  student_login_id: string;
  rank: number;
  score_percentage: number;
  correct_count: number;
  total_questions: number;
  total_time_seconds: number;
  completed_at: string;
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

// ============================================================================
// Lookups
// ============================================================================

export interface LookupOption {
  value: string;
  label: string;
}

export interface LookupOptions {
  standards: LookupOption[];
  sections: LookupOption[];
}
