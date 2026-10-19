export type NavSection =
  | 'dashboard'
  | 'question-library'
  | 'practice-arena'
  | 'revision-centre'
  | 'analytics'
  | 'import-centre';

export interface StudySession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: number; // unix timestamp ms
  endTime?: number;
  durationSeconds: number; // active study seconds
  completed: boolean;
}

export interface DailyStudyRecord {
  date: string; // YYYY-MM-DD
  totalSeconds: number;
  targetSeconds: number;
  sessionsCount: number;
  lastUpdated: number;
}

export interface TimerState {
  status: 'idle' | 'running' | 'paused';
  accumulatedSeconds: number;
  lastStartedTimestamp: number | null;
  currentSessionId: string | null;
  todayActiveSeconds: number;
}

export interface UserPreferences {
  dailyGoalMinutes: number;
  soundEnabled: boolean;
  theme: 'dark';
}

// --- Phase 2: PDF Ingestion & Question System Types ---

export interface OptionItem {
  label: string; // "A", "B", "C", "D", etc.
  text: string;
}

export type SubjectCategory =
  | 'Quantitative Aptitude'
  | 'Reasoning'
  | 'English'
  | 'General Studies'
  | 'Uncategorised';

export type VerificationStatus =
  | 'unverified'
  | 'verified'
  | 'flagged'
  | 'incomplete'
  | 'requires_correction'
  | 'unavailable_answer';

export interface ExtractedQuestion {
  id: string;
  pdf_id: string;
  source_filename: string;
  page_number: number;
  page_end_number: number;
  raw_question_number?: string;
  question_text: string;
  options: OptionItem[];
  correct_answer?: string | null;
  explanation?: string | null;
  subject?: string | null;
  topic?: string | null;
  confidence: number;
  verification_status: VerificationStatus;
  page_image_url?: string | null;
  diagram_image_url?: string | null;
  is_duplicate: number; // 0 or 1
  duplicate_of_id?: string | null;
  normalized_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface ImportJob {
  id: string;
  pdf_id: string;
  pdf_filename?: string;
  status: 'queued' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
  total_pages: number;
  processed_pages: number;
  extracted_questions: number;
  ocr_pages_count: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessingLog {
  id: number;
  job_id: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: string;
}

export interface SystemStats {
  total_questions: number;
  verified_questions: number;
  flagged_questions: number;
  unverified_questions: number;
  incomplete_questions: number;
  duplicate_questions: number;
  total_documents: number;
  by_subject: Record<string, number>;
}

// --- Phase 3: Practice Engine Types ---

export type QuestionPool =
  | 'entire'
  | 'specific_pdf'
  | 'unattempted'
  | 'all_unattempted'
  | 'incorrect'
  | 'bookmarked';

export type PracticeMode = 'untimed' | 'timed' | 'strict';

export interface PracticeConfig {
  pool: QuestionPool;
  pdf_id?: string;
  subject?: string;
  topic?: string;
  count: number | 'all';
  mode: PracticeMode;
  duration_minutes: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  include_unverified: boolean;
  review_mode?: boolean;
  correct_marks: number;
  negative_marks: number;
}

export interface PracticeAttempt {
  question_id: string;
  question_order: number;
  question_text: string;
  raw_question_number?: string;
  source_filename: string;
  page_number: number;
  page_end_number: number;
  subject?: string | null;
  topic?: string | null;
  options: OptionItem[];
  selected_option?: string | null;
  is_correct?: number | null;
  is_marked_for_review: number;
  is_visited: number;
  time_spent_seconds: number;
  is_bookmarked: number;
  correct_answer?: string | null;
  explanation?: string | null;
  page_image_url?: string | null;
}

export interface PracticeSession {
  id: string;
  config: PracticeConfig;
  status: 'in_progress' | 'completed' | 'abandoned';
  current_index: number;
  elapsed_seconds: number;
  total_questions: number;
  score: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  questions: PracticeAttempt[];
}

// --- Phase 4: Smart Revision & Mistake Tracker Types ---

export type MistakeCategory =
  | 'concept_not_clear'
  | 'calculation_error'
  | 'silly_mistake'
  | 'misread_question'
  | 'time_pressure'
  | 'guessed_answer'
  | 'other';

export type RevisionFilterType =
  | 'due'
  | 'incorrect'
  | 'skipped'
  | 'bookmarked'
  | 'difficult'
  | 'all_attempted';

export interface RevisionLogItem {
  id: number;
  attempt_date: string;
  selected_option?: string | null;
  is_correct?: number | null;
  mistake_category?: string | null;
  interval_assigned: number;
  due_date_assigned: string;
  created_at: string;
}

export interface RevisionItem extends ExtractedQuestion {
  due_date?: string;
  interval_days?: number;
  streak?: number;
  last_attempt_status?: 'correct' | 'incorrect' | 'skipped' | 'correct_difficult' | string;
  mistake_category?: MistakeCategory | string | null;
  user_notes?: string | null;
  is_difficult?: number;
  is_bookmarked?: number;
  attempts_history: RevisionLogItem[];
  latest_attempt?: RevisionLogItem | null;
}

export interface RevisionStats {
  due_count: number;
  incorrect_count: number;
  skipped_count: number;
  bookmarked_count: number;
  difficult_count: number;
  total_attempted: number;
}

// --- Phase 5: Analytics & Preparation Intelligence Types ---

export interface DashboardMetrics {
  total_questions_in_library: number;
  unique_questions_attempted: number;
  unique_questions_remaining: number;
  total_attempts: number;
  overall_accuracy: number;
  today_study_time_seconds: number;
  weekly_study_time_seconds: number;
  total_active_study_time_seconds: number;
  revision_due_count: number;
}

export interface SubjectWiseAnalytics {
  subject: string;
  total_attempts: number;
  correct_attempts: number;
  accuracy_pct: number;
  avg_time_seconds: number;
  unique_questions: number;
}

export interface TopicWiseAnalytics {
  subject: string;
  topic: string;
  total_attempts: number;
  correct_attempts: number;
  accuracy_pct: number;
  avg_time_seconds: number;
}

export interface ActivityTrend {
  date: string;
  total_attempts: number;
  correct: number;
  incorrect: number;
  accuracy_pct: number;
  study_seconds: number;
}

export interface MonthlyImprovement {
  month: string;
  total_attempts: number;
  correct: number;
  accuracy_pct: number;
}

export interface MistakeDistributionItem {
  category: string;
  count: number;
  percentage: number;
}

export interface PerformanceAnalytics {
  subject_wise: SubjectWiseAnalytics[];
  topic_wise: TopicWiseAnalytics[];
  avg_time_per_question: number;
  trends: ActivityTrend[];
  monthly_improvement: MonthlyImprovement[];
  mistake_distribution: MistakeDistributionItem[];
  revision_success_rate: number;
}

export interface ActionableRecommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  target_section: NavSection;
}

export interface PreparationIntelligence {
  weakest_topics: Array<{ subject: string; topic: string; accuracy_pct: number; total_attempts: number }>;
  unusually_long_topics: Array<{ subject: string; topic: string; avg_time_seconds: number; total_attempts: number }>;
  repeatedly_incorrect_questions: Array<{ id: string; raw_question_number?: string; subject?: string; topic?: string; question_text: string; fail_count: number }>;
  neglected_topics: Array<{ subject: string; topic: string; status: string; last_attempt?: string | null }>;
  overdue_questions: Array<{ id: string; raw_question_number?: string; subject?: string; topic?: string; due_date: string; interval_days: number; streak: number }>;
  actionable_recommendations: ActionableRecommendation[];
}

export interface StudyGoalsProgress {
  daily_hours_target: number;
  daily_question_target: number;
  subject_targets: Record<string, number>;
  today_study_seconds: number;
  today_hours_achieved: number;
  today_questions_achieved: number;
}

export interface AnalyticsOverview {
  dashboard_metrics: DashboardMetrics;
  performance_analytics: PerformanceAnalytics;
  preparation_intelligence: PreparationIntelligence;
  goals_progress: StudyGoalsProgress;
}

