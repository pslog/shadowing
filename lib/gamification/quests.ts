// Daily quest board.
//
// The old "nhiệm vụ hôm nay" was a single number — pass 5 sentences — which
// made the two other things the app actually teaches (読解 and vocabulary) look
// like side content. A day is now a *board* of three quests, one per skill,
// plus a bonus that only pays when all three are cleared. That is what makes
// the board attractive: each quest is small enough to finish in one sitting,
// and the bonus is worth more than any single quest, so the cheapest XP in the
// app is always "do the one thing you were going to skip".
//
// Deliberately NOT changed: the streak. It still advances on the shadowing
// quest alone. Gating a streak on three skills would break it for anyone who
// only has ten minutes, and a streak people lose for a good reason is a streak
// they stop caring about. Doing everything earns the bonus instead.

import { todayKey } from "@/lib/date";
import type { DailyMission, XpEvent } from "@/lib/types";

export type QuestId = "shadowing" | "reading" | "vocab";

export const QUEST_IDS = ["shadowing", "reading", "vocab"] as const;

/** Default daily targets. Stored per-row so a future "hard mode" can raise them. */
export const QUEST_TARGETS: Record<QuestId, number> = {
  shadowing: 5,
  reading: 1,
  vocab: 10,
};

/** XP paid the first time a quest is cleared on a given day. */
export const QUEST_XP: Record<QuestId, number> = {
  shadowing: 100,
  reading: 60,
  vocab: 60,
};

/** Paid once, on the day all three quests are cleared. */
export const PERFECT_DAY_XP = 150;

/** Total XP a flawless day is worth, for the "up for grabs" headline. */
export const DAILY_MAX_QUEST_XP =
  QUEST_XP.shadowing + QUEST_XP.reading + QUEST_XP.vocab + PERFECT_DAY_XP;

/** The xp_events row type each quest writes. `mission_complete` is kept for the
 *  shadowing quest so existing history and the admin breakdown stay readable. */
const QUEST_EVENT_TYPE: Record<QuestId, XpEvent["event_type"]> = {
  shadowing: "mission_complete",
  reading: "quest_reading",
  vocab: "quest_vocab",
};

export function emptyMission(
  userId: string,
  nowIso: string,
  date = todayKey(),
): DailyMission {
  return {
    id: "",
    user_id: userId,
    mission_date: date,
    target_sentence_count: QUEST_TARGETS.shadowing,
    passed_sentence_count: 0,
    is_completed: false,
    reading_target: QUEST_TARGETS.reading,
    reading_count: 0,
    vocab_target: QUEST_TARGETS.vocab,
    vocab_count: 0,
    bonus_awarded: false,
    created_at: nowIso,
  };
}

/**
 * Read a mission row tolerantly: rows written before the quest board existed
 * have no reading/vocab columns, and Supabase hands them back as undefined.
 */
export function questCount(mission: DailyMission | undefined, id: QuestId): number {
  if (!mission) return 0;
  if (id === "shadowing") return mission.passed_sentence_count ?? 0;
  if (id === "reading") return mission.reading_count ?? 0;
  return mission.vocab_count ?? 0;
}

export function questTarget(mission: DailyMission | undefined, id: QuestId): number {
  const stored =
    id === "shadowing"
      ? mission?.target_sentence_count
      : id === "reading"
        ? mission?.reading_target
        : mission?.vocab_target;
  return stored && stored > 0 ? stored : QUEST_TARGETS[id];
}

export function isQuestDone(mission: DailyMission | undefined, id: QuestId): boolean {
  return questCount(mission, id) >= questTarget(mission, id);
}

export function clearedQuestCount(mission: DailyMission | undefined): number {
  return QUEST_IDS.filter((id) => isQuestDone(mission, id)).length;
}

export function isPerfectDay(mission: DailyMission | undefined): boolean {
  return clearedQuestCount(mission) === QUEST_IDS.length;
}

export interface QuestView {
  id: QuestId;
  done: number;
  target: number;
  completed: boolean;
  xp: number;
}

export function questBoard(mission: DailyMission | undefined): QuestView[] {
  return QUEST_IDS.map((id) => {
    const target = questTarget(mission, id);
    const done = Math.min(questCount(mission, id), target);
    return { id, done, target, completed: done >= target, xp: QUEST_XP[id] };
  });
}

export interface QuestSettlement {
  /** The row with completion flags reconciled against the new counts. */
  mission: DailyMission;
  /** Quests that flipped to done on this action — what the UI celebrates. */
  newlyCompleted: QuestId[];
  /** All three cleared for the first time today. */
  perfectDayNow: boolean;
  events: XpEvent[];
  xp: number;
}

/**
 * Settle a mission row after its counts changed: pay each quest that flipped to
 * done, plus the perfect-day bonus, exactly once.
 *
 * `before` is the row as it stood *before* this action so a quest already
 * cleared earlier today pays nothing — every count here is derived from
 * "distinct thing done today", never from "times the button was pressed".
 */
export function settleQuests(args: {
  before: DailyMission | undefined;
  after: DailyMission;
  lessonId: string | null;
  nowIso: string;
  newId: () => string;
}): QuestSettlement {
  const { before, after, lessonId, nowIso, newId } = args;
  const events: XpEvent[] = [];
  let xp = 0;

  const addXp = (amount: number, type: XpEvent["event_type"]) => {
    xp += amount;
    events.push({
      id: newId(),
      user_id: after.user_id,
      event_type: type,
      xp_amount: amount,
      lesson_id: lessonId,
      sentence_id: null,
      created_at: nowIso,
    });
  };

  const newlyCompleted = QUEST_IDS.filter(
    (id) => isQuestDone(after, id) && !isQuestDone(before, id),
  );
  for (const id of newlyCompleted) addXp(QUEST_XP[id], QUEST_EVENT_TYPE[id]);

  const perfectDayNow = isPerfectDay(after) && !(before?.bonus_awarded ?? false);
  if (perfectDayNow) addXp(PERFECT_DAY_XP, "daily_bonus");

  return {
    mission: {
      ...after,
      // `is_completed` has always meant "the shadowing goal is met" — the streak
      // and every historical row depend on that reading, so it keeps it.
      is_completed: isQuestDone(after, "shadowing") || (before?.is_completed ?? false),
      bonus_awarded: (before?.bonus_awarded ?? false) || perfectDayNow,
    },
    newlyCompleted,
    perfectDayNow,
    events,
    xp,
  };
}
