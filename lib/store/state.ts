// The full local-first application state. This is the single serialized blob
// persisted to localStorage. Every collection mirrors a Supabase table so a
// future SupabaseRepository can populate the exact same shape.

import type {
  Course,
  DailyMission,
  Lesson,
  LessonProgress,
  LessonSentence,
  Profile,
  SentenceAttempt,
  XpEvent,
} from "@/lib/types";

export interface AppState {
  profile: Profile | null;
  courses: Course[];
  lessons: Lesson[];
  sentences: LessonSentence[];
  attempts: SentenceAttempt[];
  progress: LessonProgress[];
  missions: DailyMission[];
  xpEvents: XpEvent[];
}

export const STORAGE_KEY = "shadow-it-jp/v1";
export const SYSTEM_USER = "system";

export function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id-" + Math.abs(hashString(String(performance.now()))).toString(36);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

// ------------------------------------------------------------------ //
//  Seed content - public sample lessons available to every user.      //
// ------------------------------------------------------------------ //

interface SeedSentence {
  ja: string;
  note: string;
}

interface SeedLesson {
  id: string;
  course_id: string;
  title: string;
  topic: string;
  level: string;
  source_url?: string;
  media_url?: string;
  sentences: SeedSentence[];
}

interface SeedCourse {
  id: string;
  title: string;
  description: string;
  topic: string;
  level: string;
  accent: string;
}

// No local seed: the app connects to Supabase and loads the real courses /
// lessons from the database. Empty seed = no local sample data.
const SEED_COURSES: SeedCourse[] = [];
const SEED: SeedLesson[] = [];

/** Build the seed courses + lessons + sentences (public, owned by SYSTEM_USER). */
export function buildSeed(nowIso: string): {
  courses: Course[];
  lessons: Lesson[];
  sentences: LessonSentence[];
} {
  const courses: Course[] = SEED_COURSES.map((c, i) => ({
    id: c.id,
    user_id: SYSTEM_USER,
    title: c.title,
    description: c.description,
    topic: c.topic,
    level: c.level,
    accent: c.accent,
    image_url: null,
    order_index: i,
    is_public: true,
    created_at: nowIso,
  }));
  const lessons: Lesson[] = [];
  const sentences: LessonSentence[] = [];

  for (const s of SEED) {
    lessons.push({
      id: s.id,
      user_id: SYSTEM_USER,
      course_id: s.course_id,
      title: s.title,
      topic: s.topic,
      level: s.level,
      duration_seconds: null,
      source_type: "upload",
      source_url: s.source_url ?? null,
      media_url: s.media_url ?? null,
      is_public: true,
      created_at: nowIso,
    });
    s.sentences.forEach((sent, i) => {
      sentences.push({
        id: `${s.id}-s${i + 1}`,
        lesson_id: s.id,
        order_index: i,
        ja_text: sent.ja,
        furigana: null,
        vi_translation: sent.note,
        audio_url: null,
        audio_start: null,
        audio_end: null,
        pass_score: 80,
        created_at: nowIso,
      });
    });
  }
  return { courses, lessons, sentences };
}

export function emptyState(nowIso: string): AppState {
  const seed = buildSeed(nowIso);
  return {
    profile: null,
    courses: seed.courses,
    lessons: seed.lessons,
    sentences: seed.sentences,
    attempts: [],
    progress: [],
    missions: [],
    xpEvents: [],
  };
}
