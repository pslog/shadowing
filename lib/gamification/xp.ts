// XP rules. (prompt §8)

import type { XpEventType } from "@/lib/types";

export const XP_RULES = {
  sentencePass: 5,
  sentencePassHigh: 8, // total >= 90
  lessonComplete: 50,
  missionComplete: 100,
  streakMilestone: 300, // every 7-day milestone
  // 読解: finishing the passage is the work, so most of the reward is flat and
  // the quiz only tops it up. Paying per correct answer alone would turn a
  // reading lesson into a quiz to be guessed at, and a 0/3 reader — the one who
  // most needs to come back — would walk away with nothing.
  readingComplete: 40,
  readingCorrect: 10,
} as const;

/**
 * XP for finishing a 読解 lesson. Awarded once per lesson: the check can be
 * retried for the explanations, not for the points.
 */
export function xpForReading(correct: number): number {
  return XP_RULES.readingComplete + correct * XP_RULES.readingCorrect;
}

export function xpForSentence(totalScore: number): {
  amount: number;
  type: XpEventType;
} {
  return totalScore >= 90
    ? { amount: XP_RULES.sentencePassHigh, type: "sentence_pass_high" }
    : { amount: XP_RULES.sentencePass, type: "sentence_pass" };
}

/** True when hitting this streak count crosses a 7-day milestone. */
export function isStreakMilestone(streak: number): boolean {
  return streak > 0 && streak % 7 === 0;
}
