// What the mascot companion should say next.
//
// This is a pure function of app state so the decision is testable and lives in
// one place, instead of being scattered across the component that draws the
// bubble. It returns a key plus the numbers to interpolate; the wording itself
// stays in the i18n catalog so both locales read naturally.
//
// The order of the checks IS the product decision — the first match wins, so
// the list runs from "most useful to hear right now" downwards. Two rules that
// matter most:
//   - streakAtRisk outranks the plain mission nudge: losing a 12-day streak is
//     the one thing a learner actually regrets, so it gets named explicitly.
//   - nearLevelUp names the NEXT MASCOT rather than the XP alone, which turns
//     the level ladder into something you collect.

import type { AppState } from "@/lib/store/state";
import {
  inProgressLesson,
  lessonHref,
  nextLessonInCourse,
  passedCountForLesson,
  savedVocabList,
  sentencesForLesson,
  todayMission,
} from "@/lib/store/selectors";
import { levelProgress } from "@/lib/gamification/level";
import { streakActiveToday } from "@/lib/gamification/streak";

export type CompanionActionKey =
  | "guest"
  | "firstLesson"
  | "streakAtRisk"
  | "lessonProgress"
  | "lessonDone"
  | "missionLeft"
  | "nearLevelUp"
  | "resumeLesson"
  | "reviewVocab"
  | "allDone";

export interface CompanionAction {
  key: CompanionActionKey;
  /** Locale-agnostic path; the caller adds the locale prefix. */
  href: string;
  /** Sentences still needed today (missionLeft, streakAtRisk). */
  left?: number;
  /** Current streak length (streakAtRisk). */
  streak?: number;
  /** XP still needed, already formatted by the caller's locale (nearLevelUp). */
  xp?: number;
  /** Level being approached (nearLevelUp). */
  level?: number;
  /** Lesson to continue (resumeLesson). */
  lessonTitle?: string;
  /** Unlearned words in the notebook (reviewVocab). */
  words?: number;
  /** Sentences passed / total in the lesson being viewed (lessonProgress). */
  passed?: number;
  total?: number;
  /** Lesson the advice is scoped to, so the caller can tell repeats apart. */
  lessonId?: string;
}

/** Where the learner currently is, when that changes what is worth saying. */
export interface CompanionContext {
  /** Lesson currently open, if the user is on a lesson detail page. */
  lessonId?: string;
}

/**
 * How close to the next level still counts as "almost there". Proportional
 * rather than a flat XP number because a level costs ~100 XP early on and
 * ~9000 XP late — a flat threshold would fire constantly at Lv.1 and never
 * again after Lv.20.
 */
const NEAR_LEVEL_RATIO = 0.85;

export function nextCompanionAction(
  state: AppState,
  ctx: CompanionContext = {},
): CompanionAction {
  const profile = state.profile;

  if (!profile) {
    return { key: "guest", href: "/login" };
  }

  const mission = todayMission(state);
  const resumable = inProgressLesson(state);
  const resumeHref = resumable ? lessonHref(resumable) : "/courses";
  const hasAttempts = state.attempts.some(
    (attempt) => attempt.user_id === profile.id,
  );

  if (!hasAttempts) {
    return { key: "firstLesson", href: "/courses" };
  }

  if (!mission.completed) {
    const left = Math.max(1, mission.target - mission.passed);
    const streak = profile.current_streak ?? 0;
    // Only "at risk" if there is a streak to lose and today has not counted yet.
    if (streak > 0 && !streakActiveToday(profile.last_completed_date ?? null)) {
      return { key: "streakAtRisk", href: resumeHref, left, streak };
    }
  }

  // On a lesson page, progress through THIS lesson beats a generic daily count:
  // it is the number the learner can see moving. Streak risk still outranks it,
  // because that is the one thing they would regret missing.
  if (ctx.lessonId) {
    const total = sentencesForLesson(state, ctx.lessonId).length;
    const passed = passedCountForLesson(state, ctx.lessonId);
    if (total > 0 && passed >= total) {
      const lesson = state.lessons.find((item) => item.id === ctx.lessonId);
      const upcoming = lesson?.course_id
        ? nextLessonInCourse(state, lesson.course_id)
        : null;
      const next = upcoming && upcoming.id !== ctx.lessonId ? upcoming : null;
      return {
        key: "lessonDone",
        href: next ? lessonHref(next) : "/courses",
        lessonId: ctx.lessonId,
      };
    }
    if (total > 0) {
      return {
        key: "lessonProgress",
        // The player's shadowing panel; it carries scroll-mt so the header
        // does not cover the heading when we jump to it.
        href: "#shadowing-panel",
        passed,
        total,
        lessonId: ctx.lessonId,
      };
    }
  }

  if (!mission.completed) {
    const left = Math.max(1, mission.target - mission.passed);
    return { key: "missionLeft", href: resumeHref, left };
  }

  const progress = levelProgress(profile.total_xp);
  if (progress.pct >= NEAR_LEVEL_RATIO * 100) {
    return {
      key: "nearLevelUp",
      href: resumeHref,
      xp: progress.toNext,
      level: progress.level + 1,
    };
  }

  if (resumable) {
    return { key: "resumeLesson", href: resumeHref, lessonTitle: resumable.title };
  }

  const unlearned = savedVocabList(state).filter((v) => !v.learned).length;
  if (unlearned > 0) {
    return { key: "reviewVocab", href: "/review", words: unlearned };
  }

  return { key: "allDone", href: "/courses" };
}
