// Pure state transitions. No React, no I/O — everything the gamification loop
// needs to happen when a scored attempt comes in. Kept pure so it is trivially
// testable and reusable by a future server/Supabase implementation.

import { todayKey } from "@/lib/date";
import { advanceStreak, streakActiveToday } from "@/lib/gamification/streak";
import { levelFromXp } from "@/lib/gamification/level";
import { isStreakMilestone, xpForSentence, XP_RULES } from "@/lib/gamification/xp";
import type {
  DailyMission,
  LessonProgress,
  ScoreBreakdown,
  SentenceAttempt,
  XpEvent,
} from "@/lib/types";
import type { AppState } from "./state";
import { uid } from "./state";

export const DAILY_TARGET = 5;

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
  let mission = missions.find(
    (m) => m.user_id === profile.id && m.mission_date === today,
  );
  const missionWasCompleted = mission?.is_completed ?? false;
  const missionNowCompleted = missionCount >= DAILY_TARGET;

  if (!mission) {
    mission = {
      id: uid(),
      user_id: profile.id,
      mission_date: today,
      target_sentence_count: DAILY_TARGET,
      passed_sentence_count: 0,
      is_completed: false,
      created_at: nowIso,
    };
    missions.push(mission);
  }
  const updatedMission: DailyMission = {
    ...mission,
    passed_sentence_count: missionCount,
    is_completed: missionNowCompleted || missionWasCompleted,
  };
  missions[missions.indexOf(mission)] = updatedMission;

  const missionCompletedNow = !missionWasCompleted && missionNowCompleted;

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
    addXp(XP_RULES.missionComplete, "mission_complete");
    if (isStreakMilestone(streak.current_streak)) {
      addXp(XP_RULES.streakMilestone, "streak_milestone");
    }
  } else if (missionCompletedNow) {
    // Mission completed but streak already kept today (edge): still award once.
    addXp(XP_RULES.missionComplete, "mission_complete");
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
      streakIncreased,
      leveledUp: newLevel > oldLevel,
      newLevel,
      currentStreak: streak.current_streak,
    },
  };
}
