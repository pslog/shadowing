// XP rules. (prompt §8)

import type { XpEventType } from "@/lib/types";

export const XP_RULES = {
  sentencePass: 5,
  sentencePassHigh: 8, // total >= 90
  lessonComplete: 50,
  missionComplete: 100,
  streakMilestone: 300, // every 7-day milestone
} as const;

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
