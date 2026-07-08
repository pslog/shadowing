// Pure derived reads over AppState. Kept separate from the provider so pages
// import only what they need and the logic stays testable.

import { lastNDays, todayKey } from "@/lib/date";
import { DAILY_TARGET } from "./engine";
import type { AppState } from "./state";
import type {
  Lesson,
  LessonSentence,
  LessonStatus,
  LessonWithSentences,
  SentenceAttempt,
} from "@/lib/types";

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === todayKey();
}

function lessonNumber(title: string): number | null {
  const match = title.match(/^第(\d+)課/u);
  return match ? Number(match[1]) : null;
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
  const avg = (sel: (a: SentenceAttempt) => number) =>
    mine.reduce((s, a) => s + sel(a), 0) / mine.length;
  const scores: Record<Skill, number> = {
    pronunciation: avg((a) => a.pronunciation_score),
    speed: avg((a) => a.speed_score),
    intonation: avg((a) => a.intonation_score),
  };
  return (Object.keys(scores) as Skill[]).reduce((lo, k) =>
    scores[k] < scores[lo] ? k : lo,
  );
}

export const SKILL_LABEL: Record<Skill, string> = {
  pronunciation: "発音",
  speed: "速度",
  intonation: "イントネーション",
};
