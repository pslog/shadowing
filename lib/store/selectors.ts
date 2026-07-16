// Pure derived reads over AppState. Kept separate from the provider so pages
// import only what they need and the logic stays testable.

import { lastNDays, todayKey } from "@/lib/date";
import { DAILY_TARGET } from "./engine";
import type { AppState } from "./state";
import type {
  Course,
  Lesson,
  LessonSentence,
  LessonStatus,
  LessonWithSentences,
  Profile,
  SavedVocab,
  SentenceAttempt,
  VocabEntry,
} from "@/lib/types";

/** The single fixed admin — only this account may create/edit lessons. */
export const ADMIN_EMAIL = "vovansinh1991@gmail.com";

/** True when the given email is the fixed admin account. */
export function isSuperAdminEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAdminProfile(profile?: Profile | null): boolean {
  return !!profile && (profile.role === "admin" || isSuperAdminEmail(profile.email));
}

export function isSuperAdminProfile(profile?: Profile | null): boolean {
  return isSuperAdminEmail(profile?.email);
}

/** True when the signed-in user is the admin. */
export function isAdmin(state: AppState): boolean {
  return isAdminProfile(state.profile);
}

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === todayKey();
}

function lessonNumber(title: string): number | null {
  const dai = title.match(/^第(\d+)課/u);
  if (dai) return Number(dai[1]);
  // "Unit 1.1", "Unit 1.2" -> 101, 102 … (order within a course).
  const unit = title.match(/Unit\s+(\d+)\.(\d+)/iu);
  if (unit) return Number(unit[1]) * 100 + Number(unit[2]);
  // JLPT N2 聴解: "2010/7 問題1-3 …" -> chronological by exam date (year+month),
  // then by question number within that exam. Keeps mondai courses in exam order.
  const choukai = title.match(/^(\d{4})\/(\d{1,2})\s+問題\d+-(\d+)/u);
  if (choukai) {
    const [, year, month, q] = choukai;
    return Number(year) * 10000 + Number(month) * 100 + Number(q);
  }
  return null;
}

/** Lessons the current user can see: public samples + their own. */
export function visibleLessons(state: AppState): Lesson[] {
  const uid = state.profile?.id;
  return state.lessons
    .filter((l) => l.is_public || l.user_id === uid)
    .sort((a, b) => {
      const aNo = lessonNumber(a.title);
      const bNo = lessonNumber(b.title);
      if (aNo != null && bNo != null) return aNo - bNo;
      if (aNo != null) return -1;
      if (bNo != null) return 1;
      return b.created_at.localeCompare(a.created_at);
    });
}

export function lessonById(state: AppState, id: string): Lesson | undefined {
  return state.lessons.find((l) => l.id === id);
}

/** Resolve a course by slug, falling back to id (keeps old UUID links working). */
export function courseBySlug(state: AppState, key: string): Course | undefined {
  return (state.courses ?? []).find((c) => c.slug === key) ?? courseById(state, key);
}

/** Resolve a lesson by slug, falling back to id. */
export function lessonBySlug(state: AppState, key: string): Lesson | undefined {
  return state.lessons.find((l) => l.slug === key) ?? lessonById(state, key);
}

/** Build the URL path for a course / lesson (slug preferred, id fallback). */
export function courseHref(course: Pick<Course, "slug" | "id">): string {
  return `/courses/${course.slug ?? course.id}`;
}
export function lessonHref(lesson: Pick<Lesson, "slug" | "id">): string {
  return `/lessons/${lesson.slug ?? lesson.id}`;
}

// ------------------------------------------------------------------ //
//  Courses (a lesson group — book / project / series)                 //
// ------------------------------------------------------------------ //

/** Synthetic id for the "ungrouped" bucket of lessons with no course. */
export const UNCATEGORIZED_COURSE_ID = "uncategorized";

export function visibleCourses(state: AppState): Course[] {
  const uid = state.profile?.id;
  return (state.courses ?? [])
    .filter((c) => c.is_public || c.user_id === uid)
    .sort((a, b) => a.order_index - b.order_index);
}

export function courseById(state: AppState, id: string): Course | undefined {
  return (state.courses ?? []).find((c) => c.id === id);
}

/** Visible lessons in a course (or the ungrouped bucket), lesson-sorted. */
export function lessonsForCourse(state: AppState, courseId: string): Lesson[] {
  return visibleLessons(state).filter((l) =>
    courseId === UNCATEGORIZED_COURSE_ID ? l.course_id == null : l.course_id === courseId,
  );
}

/** Visible lessons not assigned to any course. */
export function uncategorizedLessons(state: AppState): Lesson[] {
  return lessonsForCourse(state, UNCATEGORIZED_COURSE_ID);
}

export interface CourseStats {
  total: number;
  completed: number;
  /** Average of each lesson's average score, over attempted lessons. null if none. */
  averageScore: number | null;
}

export function courseStats(state: AppState, courseId: string): CourseStats {
  const lessons = lessonsForCourse(state, courseId);
  const completed = lessons.filter(
    (l) => lessonStatus(state, l.id) === "completed",
  ).length;
  const scores = lessons
    .map((l) => lessonAverageScore(state, l.id))
    .filter((v): v is number => v != null);
  const averageScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;
  return { total: lessons.length, completed, averageScore };
}

/** Lessons the user has attempted, most-recently-practiced first. */
export function recentAttemptedLessons(state: AppState, n = 4): Lesson[] {
  const uid = state.profile?.id;
  const latest = new Map<string, string>();
  for (const a of state.attempts) {
    if (a.user_id !== uid) continue;
    const prev = latest.get(a.lesson_id);
    if (!prev || a.created_at > prev) latest.set(a.lesson_id, a.created_at);
  }
  return [...latest.entries()]
    .sort((x, y) => y[1].localeCompare(x[1]))
    .map(([id]) => lessonById(state, id))
    .filter((l): l is Lesson => !!l)
    .slice(0, n);
}

/** First not-yet-completed lesson in the course (for a "continue" button). */
export function nextLessonInCourse(
  state: AppState,
  courseId: string,
): Lesson | null {
  const lessons = lessonsForCourse(state, courseId);
  return (
    lessons.find((l) => lessonStatus(state, l.id) !== "completed") ??
    lessons[0] ??
    null
  );
}

export function sentencesForLesson(
  state: AppState,
  lessonId: string,
): LessonSentence[] {
  return state.sentences
    .filter((s) => s.lesson_id === lessonId)
    .sort((a, b) => a.order_index - b.order_index);
}

export function lessonWithSentences(
  state: AppState,
  id: string,
): LessonWithSentences | undefined {
  const lesson = lessonById(state, id);
  if (!lesson) return undefined;
  return { ...lesson, sentences: sentencesForLesson(state, id) };
}

export function myAttemptsForSentence(
  state: AppState,
  sentenceId: string,
): SentenceAttempt[] {
  const uid = state.profile?.id;
  return state.attempts
    .filter((a) => a.user_id === uid && a.sentence_id === sentenceId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function bestAttemptForSentence(
  state: AppState,
  sentenceId: string,
): SentenceAttempt | null {
  const list = myAttemptsForSentence(state, sentenceId);
  if (list.length === 0) return null;
  return list.reduce((best, a) => (a.total_score > best.total_score ? a : best));
}

export function isSentencePassed(state: AppState, sentenceId: string): boolean {
  return myAttemptsForSentence(state, sentenceId).some((a) => a.is_passed);
}

/**
 * Average of the best score per sentence across a lesson (over sentences the
 * user has actually attempted). null if none attempted yet.
 */
export function lessonAverageScore(
  state: AppState,
  lessonId: string,
): number | null {
  const bests = sentencesForLesson(state, lessonId)
    .map((s) => bestAttemptForSentence(state, s.id)?.total_score)
    .filter((v): v is number => v != null);
  if (bests.length === 0) return null;
  return Math.round(bests.reduce((a, b) => a + b, 0) / bests.length);
}

export function passedCountForLesson(
  state: AppState,
  lessonId: string,
): number {
  const ids = sentencesForLesson(state, lessonId).map((s) => s.id);
  return ids.filter((id) => isSentencePassed(state, id)).length;
}

export function lastAttemptAtForLesson(
  state: AppState,
  lessonId: string,
): string | null {
  const uid = state.profile?.id;
  const latest = state.attempts
    .filter((attempt) => attempt.user_id === uid && attempt.lesson_id === lessonId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return latest?.created_at ?? null;
}

export function lessonStatus(
  state: AppState,
  lessonId: string,
): LessonStatus {
  const total = sentencesForLesson(state, lessonId).length;
  const passed = passedCountForLesson(state, lessonId);
  if (passed === 0) return "not_started";
  if (total > 0 && passed >= total) return "completed";
  return "in_progress";
}

/** Most recently practiced lesson that is still in progress. */
export function inProgressLesson(state: AppState): Lesson | null {
  const uid = state.profile?.id;
  const recent = [...state.attempts]
    .filter((a) => a.user_id === uid)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const a of recent) {
    if (lessonStatus(state, a.lesson_id) === "in_progress") {
      return lessonById(state, a.lesson_id) ?? null;
    }
  }
  return null;
}

/** Distinct sentences the user passed today (drives the daily mission). */
export function passedSentencesToday(state: AppState): number {
  const uid = state.profile?.id;
  const set = new Set(
    state.attempts
      .filter((a) => a.user_id === uid && a.is_passed && isToday(a.created_at))
      .map((a) => a.sentence_id),
  );
  return set.size;
}

export interface MissionView {
  passed: number;
  target: number;
  completed: boolean;
}

export function todayMission(state: AppState): MissionView {
  const passed = passedSentencesToday(state);
  return {
    passed,
    target: DAILY_TARGET,
    completed: passed >= DAILY_TARGET,
  };
}

export interface DayStat {
  date: string;
  count: number;
}

/** Distinct sentences passed per day over the last `n` days (oldest first). */
export function dailyPassStats(state: AppState, n: number): DayStat[] {
  const uid = state.profile?.id;
  const days = lastNDays(n);
  const byDay = new Map<string, Set<string>>();
  for (const d of days) byDay.set(d, new Set());
  for (const a of state.attempts) {
    if (a.user_id !== uid || !a.is_passed) continue;
    const key = a.created_at.slice(0, 10);
    byDay.get(key)?.add(a.sentence_id);
  }
  return days.map((d) => ({ date: d, count: byDay.get(d)?.size ?? 0 }));
}

export function passedThisWeek(state: AppState): number {
  return dailyPassStats(state, 7).reduce((s, d) => s + d.count, 0);
}

export function totalCompletedLessons(state: AppState): number {
  return visibleLessons(state).filter(
    (l) => lessonStatus(state, l.id) === "completed",
  ).length;
}

export function totalPassedSentences(state: AppState): number {
  const uid = state.profile?.id;
  const set = new Set(
    state.attempts
      .filter((a) => a.user_id === uid && a.is_passed)
      .map((a) => a.sentence_id),
  );
  return set.size;
}

export function averageScore(state: AppState): number | null {
  const uid = state.profile?.id;
  const mine = state.attempts.filter((a) => a.user_id === uid);
  if (mine.length === 0) return null;
  return Math.round(
    mine.reduce((s, a) => s + a.total_score, 0) / mine.length,
  );
}

export type Skill = "pronunciation" | "speed" | "intonation";

/** The dimension with the lowest average score (the user's weak point). */
export function weakestSkill(state: AppState): Skill | null {
  const uid = state.profile?.id;
  const mine = state.attempts.filter((a) => a.user_id === uid);
  if (mine.length === 0) return null;
  // Average only over values that exist (intonation may be unmeasured).
  const avg = (sel: (a: SentenceAttempt) => number | null) => {
    const vals = mine.map(sel).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  const scores: Partial<Record<Skill, number>> = {
    pronunciation: avg((a) => a.pronunciation_score) ?? undefined,
    speed: avg((a) => a.speed_score) ?? undefined,
    intonation: avg((a) => a.intonation_score) ?? undefined,
  };
  const measured = (Object.keys(scores) as Skill[]).filter(
    (k) => scores[k] != null,
  );
  if (measured.length === 0) return null;
  return measured.reduce((lo, k) =>
    (scores[k] as number) < (scores[lo] as number) ? k : lo,
  );
}

export const SKILL_LABEL: Record<Skill, string> = {
  pronunciation: "発音",
  speed: "速度",
  intonation: "イントネーション",
};

// --------------------------------------------------------------------------- //
//  Saved vocabulary (personal review notebook)                                 //
// --------------------------------------------------------------------------- //

/** Stable identity for a vocab entry within a user's notebook. */
export function vocabKey(word: string, reading: string): string {
  return `${word}|${reading}`;
}

/** The current user's saved words, newest first. */
export function savedVocabList(state: AppState): SavedVocab[] {
  const uid = state.profile?.id;
  return state.savedVocab
    .filter((v) => v.user_id === uid)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Whether the given vocab entry is already in the user's notebook. */
export function isVocabSaved(state: AppState, entry: VocabEntry): boolean {
  const uid = state.profile?.id;
  const key = vocabKey(entry.word, entry.reading);
  return state.savedVocab.some(
    (v) => v.user_id === uid && vocabKey(v.word, v.reading) === key,
  );
}
