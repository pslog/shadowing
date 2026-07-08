// Domain types — mirror the Supabase schema in prompt.txt §4 so the local
// store can later be swapped for a Supabase-backed repository with no changes
// to the UI layer.

export type LessonStatus = "not_started" | "in_progress" | "completed";

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  total_xp: number;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null; // YYYY-MM-DD
  created_at: string;
}

export interface Lesson {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  level: string | null;
  duration_seconds: number | null;
  source_type: "upload" | "youtube";
  source_url: string | null;
  media_url: string | null;
  is_public: boolean;
  created_at: string;
}

export interface LessonSentence {
  id: string;
  lesson_id: string;
  order_index: number;
  ja_text: string;
  vi_translation: string | null;
  audio_url: string | null;
  audio_start: number | null;
  audio_end: number | null;
  pass_score: number;
  created_at: string;
}

export interface SentenceAttempt {
  id: string;
  user_id: string;
  lesson_id: string;
  sentence_id: string;
  recording_url: string | null;
  pronunciation_score: number;
  speed_score: number;
  intonation_score: number;
  total_score: number;
  transcript_text: string | null;
  duration_seconds: number | null;
  is_passed: boolean;
  feedback: string | null;
  created_at: string;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  status: LessonStatus;
  passed_sentence_count: number;
  total_sentence_count: number;
  completed_at: string | null;
  updated_at: string;
}

export interface DailyMission {
  id: string;
  user_id: string;
  mission_date: string; // YYYY-MM-DD
  target_sentence_count: number;
  passed_sentence_count: number;
  is_completed: boolean;
  created_at: string;
}

export type XpEventType =
  | "sentence_pass"
  | "sentence_pass_high"
  | "lesson_complete"
  | "mission_complete"
  | "streak_milestone";

export interface XpEvent {
  id: string;
  user_id: string;
  event_type: XpEventType;
  xp_amount: number;
  lesson_id: string | null;
  sentence_id: string | null;
  created_at: string;
}

/** A lesson joined with its sentences — convenience shape for the UI. */
export interface LessonWithSentences extends Lesson {
  sentences: LessonSentence[];
}

/** Scores returned by the scoring engine / /api/score. */
export interface ScoreBreakdown {
  pronunciation: number;
  speed: number;
  intonation: number;
  total: number;
  passed: boolean;
  feedback: string;
}
