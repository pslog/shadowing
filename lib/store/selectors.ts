// Pure derived reads over AppState. Kept separate from the provider so pages
// import only what they need and the logic stays testable.

import { lastNDays, todayKey } from "@/lib/date";
import {
  DAILY_MAX_QUEST_XP,
  emptyMission,
  isQuestDone,
  PERFECT_DAY_XP,
  QUEST_IDS,
  questBoard,
  type QuestId,
  type QuestView,
} from "@/lib/gamification/quests";
import { N2_COURSE_ID, N2_COURSE_SLUG } from "@/lib/n2-course";
import { DAILY_TARGET } from "./engine";
import type { AppState } from "./state";
import type {
  Course,
  DailyMission,
  Lesson,
  LessonProgress,
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
  const lesson = title.match(/^Lesson\s+(\d+)/iu);
  if (lesson) return Number(lesson[1]);
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

/** Lessons the current user can see: public samples + their own (admins see all,
 *  incl. private/未公開 lessons like freshly-seeded exams). */
export function visibleLessons(state: AppState): Lesson[] {
  const uid = state.profile?.id;
  const admin = isAdmin(state);
  return state.lessons
    .filter((l) => admin || l.is_public || l.user_id === uid)
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
  if (key === "jlpt-n2-kai") {
    return (
      (state.courses ?? []).find((c) => c.slug === N2_COURSE_SLUG) ??
      courseById(state, N2_COURSE_ID)
    );
  }
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
  const admin = isAdmin(state);
  return (state.courses ?? [])
    .filter((c) => admin || c.is_public || c.user_id === uid)
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
/**
 * 読解 lessons are read, not shadowed: no recorder, no attempts, no XP. Anything
 * that phrases progress in passed sentences has to branch on this first, or it
 * ends up telling a reader they have "passed 0/27 sentences".
 *
 * The topic can sit on the lesson or be inherited from its course, matching what
 * the player itself checks when it picks the reading layout.
 */
export function isReadingLesson(state: AppState, lesson: Lesson | undefined): boolean {
  if (!lesson) return false;
  if (lesson.topic === "読解") return true;
  const course = lesson.course_id ? courseById(state, lesson.course_id) : undefined;
  return course?.topic === "読解";
}

/**
 * A 読解 lesson to send the daily reading quest at: the first one the user has
 * not finished, falling back to the first one at all so a learner who has read
 * everything still gets a working link (re-reading re-earns the quest).
 */
export function nextReadingLesson(state: AppState): Lesson | null {
  const reading = visibleLessons(state).filter((lesson) =>
    isReadingLesson(state, lesson),
  );
  const uid = state.profile?.id;
  const completed = new Set(
    state.progress
      .filter((item) => item.user_id === uid && item.status === "completed")
      .map((item) => item.lesson_id),
  );
  return reading.find((lesson) => !completed.has(lesson.id)) ?? reading[0] ?? null;
}

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
 * The persisted per-lesson progress row for the signed-in user, if any.
 *
 * This is the only progress source that does not depend on `state.sentences`,
 * which is loaded LAZILY (one lesson at a time — the N2 course alone has 900+
 * lessons, so loading every sentence up front is not an option). Any status or
 * percentage computed only from the loaded sentences therefore reads
 * "not started · 0%" on a course page for lessons the learner has finished.
 * lesson_progress is written on every passed sentence (lib/store/engine.ts) and
 * loaded in full at sign-in, so it is what these selectors trust when the
 * sentence rows are not in memory.
 */
export function lessonProgressRow(
  state: AppState,
  lessonId: string,
): LessonProgress | null {
  const uid = state.profile?.id;
  if (!uid) return null;
  return (
    state.progress.find((p) => p.user_id === uid && p.lesson_id === lessonId) ??
    null
  );
}

/**
 * Sentence count for a lesson. The loaded rows when they are in memory, else
 * the count map, else what the progress row recorded — in that order, because
 * that is also the order of freshness.
 */
export function lessonSentenceTotal(state: AppState, lessonId: string): number {
  const loaded = sentencesForLesson(state, lessonId).length;
  if (loaded > 0) return loaded;
  const counted = state.sentenceCounts?.[lessonId];
  if (counted != null) return counted;
  return lessonProgressRow(state, lessonId)?.total_sentence_count ?? 0;
}

/**
 * Average of the best score per sentence across a lesson (over sentences the
 * user has actually attempted). null if none attempted yet.
 *
 * Computed from the attempts, which carry `lesson_id` themselves, so a course
 * page gets real averages without the lesson's sentences being loaded.
 */
export function lessonAverageScore(
  state: AppState,
  lessonId: string,
): number | null {
  const uid = state.profile?.id;
  if (!uid) return null;
  const best = new Map<string, number>();
  for (const a of state.attempts) {
    if (a.user_id !== uid || a.lesson_id !== lessonId) continue;
    const cur = best.get(a.sentence_id);
    if (cur == null || a.total_score > cur) best.set(a.sentence_id, a.total_score);
  }
  if (best.size === 0) return null;
  let sum = 0;
  for (const v of best.values()) sum += v;
  return Math.round(sum / best.size);
}

export function passedCountForLesson(
  state: AppState,
  lessonId: string,
): number {
  const ids = sentencesForLesson(state, lessonId).map((s) => s.id);
  const loaded = ids.filter((id) => isSentencePassed(state, id)).length;
  // Whichever knows more: the recorded count when the sentences are not loaded,
  // the live count while the learner is in the lesson (it moves first).
  const recorded = lessonProgressRow(state, lessonId)?.passed_sentence_count ?? 0;
  return Math.max(loaded, recorded);
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
  const total = lessonSentenceTotal(state, lessonId);
  const passed = passedCountForLesson(state, lessonId);
  if (total > 0 && passed >= total) return "completed";
  if (passed > 0) return "in_progress";
  // A recorded "completed" survives even if the counts are unknown; a lesson
  // that later gained sentences falls back to in_progress above, which is right.
  return lessonProgressRow(state, lessonId)?.status ?? "not_started";
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

/** The shadowing quest alone — what the streak and its copy are phrased in. */
export function todayMission(state: AppState): MissionView {
  const passed = passedSentencesToday(state);
  return {
    passed,
    target: DAILY_TARGET,
    completed: passed >= DAILY_TARGET,
  };
}

/** Today's quest row, or undefined before the user has done anything today. */
export function todayMissionRow(state: AppState): DailyMission | undefined {
  const uid = state.profile?.id;
  if (!uid) return undefined;
  const today = todayKey();
  return state.missions.find(
    (m) => m.user_id === uid && m.mission_date === today,
  );
}

export interface QuestBoardView {
  quests: QuestView[];
  cleared: number;
  total: number;
  /** All quests done — the bonus is either paid or about to be. */
  perfect: boolean;
  /** XP still on the table today, bonus included. */
  xpRemaining: number;
  /** XP the board has already paid out today. */
  xpEarned: number;
}

/**
 * The whole daily board, ready to render.
 *
 * Shadowing is recomputed from today's attempts rather than trusted from the
 * row: attempts sync on every submission, while the row can lag behind a device
 * that went offline mid-session, and a progress bar that reads low after real
 * work is the one bug that makes a quest board feel broken.
 */
export function todayQuestBoard(state: AppState): QuestBoardView {
  const row = todayMissionRow(state);
  const merged: DailyMission | undefined = row
    ? { ...row, passed_sentence_count: passedSentencesToday(state) }
    : state.profile
      ? {
          ...emptyMission(state.profile.id, new Date().toISOString()),
          passed_sentence_count: passedSentencesToday(state),
        }
      : undefined;

  const quests = questBoard(merged);
  const cleared = quests.filter((q) => q.completed).length;
  const perfect = cleared === quests.length;
  const bonusPaid = row?.bonus_awarded ?? false;
  const xpEarned =
    quests.reduce((sum, q) => sum + (q.completed ? q.xp : 0), 0) +
    (bonusPaid || perfect ? PERFECT_DAY_XP : 0);

  return {
    quests,
    cleared,
    total: quests.length,
    perfect,
    xpRemaining: DAILY_MAX_QUEST_XP - xpEarned,
    xpEarned,
  };
}

export interface QuestDayStat {
  date: string;
  done: Record<QuestId, boolean>;
  cleared: number;
  perfect: boolean;
}

/**
 * Which quests were cleared on each of the last `n` days, oldest first.
 *
 * This is the retrospective half of the quest board: the board answers "what
 * is left today", this answers "have I been showing up". Past days come from
 * the stored rows; today's shadowing count is recomputed from attempts for the
 * same reason `todayQuestBoard` does it — the row can lag a device that went
 * offline, and the strip must not contradict the board sitting above it.
 */
export function questHistory(state: AppState, n: number): QuestDayStat[] {
  const uid = state.profile?.id;
  const today = todayKey();
  const passedToday = passedSentencesToday(state);

  const byDate = new Map<string, DailyMission>();
  if (uid) {
    for (const row of state.missions) {
      if (row.user_id === uid) byDate.set(row.mission_date, row);
    }
  }

  return lastNDays(n).map((date) => {
    let row = byDate.get(date);
    if (date === today && uid) {
      const base = row ?? emptyMission(uid, new Date().toISOString(), date);
      row = { ...base, passed_sentence_count: passedToday };
    }
    const done = {
      shadowing: isQuestDone(row, "shadowing"),
      reading: isQuestDone(row, "reading"),
      vocab: isQuestDone(row, "vocab"),
    };
    const cleared = QUEST_IDS.filter((id) => done[id]).length;
    return { date, done, cleared, perfect: cleared === QUEST_IDS.length };
  });
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
