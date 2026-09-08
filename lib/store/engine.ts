// Pure state transitions. No React, no I/O — everything the gamification loop
// needs to happen when a scored attempt comes in. Kept pure so it is trivially
// testable and reusable by a future server/Supabase implementation.

import { todayKey } from "@/lib/date";
import { advanceStreak, streakActiveToday } from "@/lib/gamification/streak";
import { levelFromXp } from "@/lib/gamification/level";
import {
  isStreakMilestone,
  xpForReading,
  xpForSentence,
  XP_RULES,
} from "@/lib/gamification/xp";
import {
  emptyMission,
  QUEST_TARGETS,
  settleQuests,
  type QuestId,
} from "@/lib/gamification/quests";
import type {
  DailyMission,
  LessonProgress,
  ScoreBreakdown,
  SentenceAttempt,
  XpEvent,
} from "@/lib/types";
import type { AppState } from "./state";
import { uid } from "./state";

export const DAILY_TARGET = QUEST_TARGETS.shadowing;

/** Today's quest row for a user, or undefined when the day is untouched. */
function findMission(
  missions: DailyMission[],
  userId: string,
  date: string,
): number {
  return missions.findIndex(
    (m) => m.user_id === userId && m.mission_date === date,
  );
}

export interface AttemptInput {
  sentenceId: string;
  score: ScoreBreakdown;
  recordingUrl: string | null;
  transcript: string | null;
  userDurationSeconds: number | null;
}

export interface AttemptOutcome {
  attempt: SentenceAttempt;
  /** Best total for this sentence before this attempt (null if first ever). */
  previousBestTotal: number | null;
  /** This attempt passed the sentence for the first time today. */
  countedToday: boolean;
  xpGained: number;
  lessonCompletedNow: boolean;
  missionCompletedNow: boolean;
  /** Quests that flipped to done on this attempt (shadowing, and any knock-on). */
  questsCompletedNow: QuestId[];
  /** All three daily quests are now cleared, for the first time today. */
  perfectDayNow: boolean;
  streakIncreased: boolean;
  leveledUp: boolean;
  newLevel: number;
  currentStreak: number;
}

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === todayKey();
}

/**
 * Apply a scored attempt. Returns the next state and a rich outcome the UI
 * uses for messaging (improvement, mission/streak/level transitions).
 */
export function applyAttempt(
  state: AppState,
  input: AttemptInput,
  nowIso: string,
): { state: AppState; outcome: AttemptOutcome } {
  const profile = state.profile;
  if (!profile) throw new Error("applyAttempt: no profile");

  const sentence = state.sentences.find((s) => s.id === input.sentenceId);
  if (!sentence) throw new Error("applyAttempt: sentence not found");
  const lessonId = sentence.lesson_id;
  const { score } = input;

  const myAttemptsForSentence = state.attempts.filter(
    (a) => a.user_id === profile.id && a.sentence_id === input.sentenceId,
  );
  const previousBestTotal =
    myAttemptsForSentence.length > 0
      ? Math.max(...myAttemptsForSentence.map((a) => a.total_score))
      : null;
  const passedTodayAlready = myAttemptsForSentence.some(
    (a) => a.is_passed && isToday(a.created_at),
  );

  const attempt: SentenceAttempt = {
    id: uid(),
    user_id: profile.id,
    lesson_id: lessonId,
    sentence_id: input.sentenceId,
    recording_url: input.recordingUrl,
    pronunciation_score: score.pronunciation,
    speed_score: score.speed,
    coverage_score: score.coverage,
    intonation_score: score.intonation,
    total_score: score.total,
    transcript_text: input.transcript,
    duration_seconds: input.userDurationSeconds,
    is_passed: score.passed,
    feedback: score.feedback,
    created_at: nowIso,
  };

  const attempts = [...state.attempts, attempt];
  const xpEvents = [...state.xpEvents];
  let xpGained = 0;
  const addXp = (
    amount: number,
    type: XpEvent["event_type"],
    sentenceId: string | null = null,
  ) => {
    xpGained += amount;
    xpEvents.push({
      id: uid(),
      user_id: profile.id,
      event_type: type,
      xp_amount: amount,
      lesson_id: lessonId,
      sentence_id: sentenceId,
      created_at: nowIso,
    });
  };

  // This attempt "counts" (for XP + mission) only if it passed and the sentence
  // had not already been passed earlier today — prevents same-day spamming.
  const countedToday = score.passed && !passedTodayAlready;
  if (countedToday) {
    const { amount, type } = xpForSentence(score.total);
    addXp(amount, type, input.sentenceId);
  }

  // ---- lesson_progress ------------------------------------------------ //
  const lessonSentenceIds = state.sentences
    .filter((s) => s.lesson_id === lessonId)
    .map((s) => s.id);
  const passedInLesson = new Set(
    attempts
      .filter(
        (a) =>
          a.user_id === profile.id &&
          a.lesson_id === lessonId &&
          a.is_passed,
      )
      .map((a) => a.sentence_id),
  );
  const passedCount = [...passedInLesson].filter((id) =>
    lessonSentenceIds.includes(id),
  ).length;
  const totalCount = lessonSentenceIds.length;

  const progress = [...state.progress];
  let progRec = progress.find(
    (p) => p.user_id === profile.id && p.lesson_id === lessonId,
  );
  const wasCompleted = progRec?.status === "completed";
  const nowCompleted = totalCount > 0 && passedCount >= totalCount;

  if (!progRec) {
    progRec = {
      id: uid(),
      user_id: profile.id,
      lesson_id: lessonId,
      status: "in_progress",
      passed_sentence_count: 0,
      total_sentence_count: totalCount,
      completed_at: null,
      updated_at: nowIso,
    };
    progress.push(progRec);
  }
  const updatedProg: LessonProgress = {
    ...progRec,
    passed_sentence_count: passedCount,
    total_sentence_count: totalCount,
    status: nowCompleted ? "completed" : "in_progress",
    completed_at: nowCompleted
      ? progRec.completed_at ?? nowIso
      : null,
    updated_at: nowIso,
  };
  progress[progress.indexOf(progRec)] = updatedProg;

  const lessonCompletedNow = !wasCompleted && nowCompleted;
  if (lessonCompletedNow) addXp(XP_RULES.lessonComplete, "lesson_complete");

  // ---- daily_mission -------------------------------------------------- //
  const today = todayKey();
  const passedSentencesToday = new Set(
    attempts
      .filter(
        (a) => a.user_id === profile.id && a.is_passed && isToday(a.created_at),
      )
      .map((a) => a.sentence_id),
  );
  const missionCount = passedSentencesToday.size;

  const missions = [...state.missions];
  const missionIndex = findMission(missions, profile.id, today);
  const missionBefore = missionIndex >= 0 ? missions[missionIndex] : undefined;
  const settlement = settleQuests({
    before: missionBefore,
    after: {
      ...(missionBefore ?? { ...emptyMission(profile.id, nowIso, today), id: uid() }),
      passed_sentence_count: missionCount,
    },
    lessonId,
    nowIso,
    newId: uid,
  });
  if (missionIndex >= 0) missions[missionIndex] = settlement.mission;
  else missions.push(settlement.mission);

  // Quest payouts (shadowing + the perfect-day bonus if this attempt closed the
  // board) are settled centrally so every entry point pays them identically.
  xpGained += settlement.xp;
  xpEvents.push(...settlement.events);

  const missionCompletedNow = settlement.newlyCompleted.includes("shadowing");

  // ---- streak (only on the mission-completing transition) ------------- //
  let streak = {
    current_streak: profile.current_streak,
    longest_streak: profile.longest_streak,
    last_completed_date: profile.last_completed_date,
  };
  let streakIncreased = false;
  if (missionCompletedNow && !streakActiveToday(streak.last_completed_date)) {
    const before = streak.current_streak;
    streak = advanceStreak(streak);
    streakIncreased = streak.current_streak !== before || before === 0;
    if (isStreakMilestone(streak.current_streak)) {
      addXp(XP_RULES.streakMilestone, "streak_milestone");
    }
  }

  // ---- profile (xp / level / streak) ---------------------------------- //
  const newTotalXp = profile.total_xp + xpGained;
  const oldLevel = profile.current_level;
  const newLevel = levelFromXp(newTotalXp);

  const nextProfile = {
    ...profile,
    total_xp: newTotalXp,
    current_level: newLevel,
    current_streak: streak.current_streak,
    longest_streak: streak.longest_streak,
    last_completed_date: streak.last_completed_date,
  };

  return {
    state: {
      ...state,
      profile: nextProfile,
      attempts,
      progress,
      missions,
      xpEvents,
    },
    outcome: {
      attempt,
      previousBestTotal,
      countedToday,
      xpGained,
      lessonCompletedNow,
      missionCompletedNow,
      questsCompletedNow: settlement.newlyCompleted,
      perfectDayNow: settlement.perfectDayNow,
      streakIncreased,
      leveledUp: newLevel > oldLevel,
      newLevel,
      currentStreak: streak.current_streak,
    },
  };
}

export interface ReadingCompleteInput {
  lessonId: string;
  correct: number;
  total: number;
}

export interface ReadingOutcome {
  lessonId: string;
  correct: number;
  total: number;
  xpGained: number;
  /** The lesson was already completed, so this pass earns nothing. */
  repeat: boolean;
  /** This read counted toward the daily 読解 quest. */
  countedToday: boolean;
  questsCompletedNow: QuestId[];
  perfectDayNow: boolean;
  leveledUp: boolean;
  newLevel: number;
}

/**
 * Finish a 読解 lesson: mark it read and pay out XP.
 *
 * Reading used to be the one activity that moved no number at all, which made
 * it read as filler next to shadowing. It now earns XP on the same ladder AND
 * clears its own quest on the daily board — but still never the shadowing quest
 * or the streak, which are defined in passed sentences. Letting a page of
 * reading satisfy "practise 5 sentences today" would hollow out the streak
 * rather than reward the reader.
 *
 * Lesson XP is paid once per lesson (`repeat`), so re-opening the check to read
 * the explanations is free and never feels like farming. Quest credit is looser
 * — once per lesson per *day* — so a learner who has already read everything
 * can still clear today's board by revisiting a passage.
 */
export function applyReadingComplete(
  state: AppState,
  input: ReadingCompleteInput,
  nowIso: string,
): { state: AppState; outcome: ReadingOutcome } {
  const profile = state.profile;
  if (!profile) throw new Error("applyReadingComplete: no profile");

  const sentenceCount = state.sentences.filter(
    (sentence) => sentence.lesson_id === input.lessonId,
  ).length;
  const existing = state.progress.find(
    (item) => item.user_id === profile.id && item.lesson_id === input.lessonId,
  );
  const repeat = existing?.status === "completed";
  const today = todayKey();
  // Already read *today*? Then the quest was paid for this lesson already.
  const creditedToday = existing?.updated_at.slice(0, 10) === today;

  const progressRow: LessonProgress = {
    id: existing?.id ?? uid(),
    user_id: profile.id,
    lesson_id: input.lessonId,
    status: "completed",
    passed_sentence_count: Math.max(existing?.passed_sentence_count ?? 0, sentenceCount),
    total_sentence_count: Math.max(existing?.total_sentence_count ?? 0, sentenceCount),
    completed_at: existing?.completed_at ?? nowIso,
    updated_at: nowIso,
  };
  const progress = existing
    ? state.progress.map((item) => (item.id === existing.id ? progressRow : item))
    : [...state.progress, progressRow];

  let xpGained = repeat ? 0 : xpForReading(input.correct);
  const xpEvents = [...state.xpEvents];
  if (xpGained > 0) {
    xpEvents.push({
      id: uid(),
      user_id: profile.id,
      event_type: "reading_complete",
      xp_amount: xpGained,
      lesson_id: input.lessonId,
      sentence_id: null,
      created_at: nowIso,
    });
  }

  // ---- daily quest board --------------------------------------------- //
  const missions = [...state.missions];
  const missionIndex = findMission(missions, profile.id, today);
  const missionBefore = missionIndex >= 0 ? missions[missionIndex] : undefined;
  const base =
    missionBefore ?? { ...emptyMission(profile.id, nowIso, today), id: uid() };
  const settlement = settleQuests({
    before: missionBefore,
    after: {
      ...base,
      reading_count: (base.reading_count ?? 0) + (creditedToday ? 0 : 1),
    },
    lessonId: input.lessonId,
    nowIso,
    newId: uid,
  });
  if (missionIndex >= 0) missions[missionIndex] = settlement.mission;
  else missions.push(settlement.mission);
  xpGained += settlement.xp;
  xpEvents.push(...settlement.events);

  const newTotalXp = profile.total_xp + xpGained;
  const oldLevel = profile.current_level;
  const newLevel = levelFromXp(newTotalXp);

  return {
    state: {
      ...state,
      profile: { ...profile, total_xp: newTotalXp, current_level: newLevel },
      progress,
      missions,
      xpEvents,
    },
    outcome: {
      lessonId: input.lessonId,
      correct: input.correct,
      total: input.total,
      xpGained,
      repeat,
      countedToday: !creditedToday,
      questsCompletedNow: settlement.newlyCompleted,
      perfectDayNow: settlement.perfectDayNow,
      leveledUp: newLevel > oldLevel,
      newLevel,
    },
  };
}

export interface VocabOutcome {
  /** Words credited to the vocabulary quest by this action. */
  learned: number;
  xpGained: number;
  questsCompletedNow: QuestId[];
  perfectDayNow: boolean;
  leveledUp: boolean;
  newLevel: number;
  /** The board after this action, for immediate UI feedback. */
  vocabCount: number;
  vocabTarget: number;
}

/**
 * Credit words learned toward today's vocabulary quest.
 *
 * The caller passes how many words *newly* became mastered — never how many
 * were answered — so re-drilling a word already known earns nothing and the
 * quest cannot be farmed by spamming a deck the user has already finished.
 *
 * Learning words pays no XP of its own (the quest is the reward); the drill is
 * already its own spaced-repetition loop.
 */
export function applyVocabProgress(
  state: AppState,
  learned: number,
  nowIso: string,
): { state: AppState; outcome: VocabOutcome | null } {
  const profile = state.profile;
  if (!profile || learned <= 0) return { state, outcome: null };

  const today = todayKey();
  const missions = [...state.missions];
  const missionIndex = findMission(missions, profile.id, today);
  const missionBefore = missionIndex >= 0 ? missions[missionIndex] : undefined;
  const base =
    missionBefore ?? { ...emptyMission(profile.id, nowIso, today), id: uid() };
  const settlement = settleQuests({
    before: missionBefore,
    after: { ...base, vocab_count: (base.vocab_count ?? 0) + learned },
    lessonId: null,
    nowIso,
    newId: uid,
  });
  if (missionIndex >= 0) missions[missionIndex] = settlement.mission;
  else missions.push(settlement.mission);

  const newTotalXp = profile.total_xp + settlement.xp;
  const oldLevel = profile.current_level;
  const newLevel = levelFromXp(newTotalXp);

  return {
    state: {
      ...state,
      profile: { ...profile, total_xp: newTotalXp, current_level: newLevel },
      missions,
      xpEvents: [...state.xpEvents, ...settlement.events],
    },
    outcome: {
      learned,
      xpGained: settlement.xp,
      questsCompletedNow: settlement.newlyCompleted,
      perfectDayNow: settlement.perfectDayNow,
      leveledUp: newLevel > oldLevel,
      newLevel,
      vocabCount: settlement.mission.vocab_count ?? 0,
      vocabTarget: settlement.mission.vocab_target ?? QUEST_TARGETS.vocab,
    },
  };
}
