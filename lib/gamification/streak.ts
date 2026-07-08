// Streak logic. (prompt §7)
//
// Called exactly when a daily mission flips from not-completed -> completed.
// Returns the new streak state. A day can only increment the streak once —
// the caller guarantees this by only invoking on the completing transition.

import { daysBetween, todayKey } from "@/lib/date";

export interface StreakState {
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
}

export function advanceStreak(prev: StreakState): StreakState {
  const today = todayKey();

  // Already counted today — no change (defensive; caller shouldn't re-fire).
  if (prev.last_completed_date === today) return prev;

  let current: number;
  if (!prev.last_completed_date) {
    current = 1;
  } else {
    const gap = daysBetween(prev.last_completed_date, today);
    current = gap === 1 ? prev.current_streak + 1 : 1;
  }

  return {
    current_streak: current,
    longest_streak: Math.max(prev.longest_streak, current),
    last_completed_date: today,
  };
}

/** True if the streak is at risk (not yet kept today). */
export function streakActiveToday(lastCompletedDate: string | null): boolean {
  return lastCompletedDate === todayKey();
}
