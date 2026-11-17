// Study plan + spaced repetition for public vocabulary books.
//
// A plan turns "656 Kanji, start anywhere" into a fixed sequence of days: six
// learning days followed by one review day, repeated until the book ends. Days
// are cut by WORD count, not entry count — a Kanji can carry one example word
// or six, so "10 Kanji a day" swings between ~15 and ~50 words. Entries are
// never split, and book order is kept.
//
// Nothing per-day is stored. The schedule is recomputed from the entries and
// `words_per_day`, and a learning day's status is derived from per-word quiz
// state, so changing pace never strands progress. Only review days need a
// stored flag (`reviews_done`), because "I reviewed week 3" leaves no trace on
// any single word.

import { daysBetween, todayKey, toDateKey } from "@/lib/date";
import type { VocabularyBookEntry, VocabularyBookPlan } from "@/lib/types";

export const LEARN_DAYS_PER_WEEK = 6;

/** Review intervals (days). A word climbs one rung per on-time correct answer. */
export const SRS_LADDER = [1, 3, 7, 14, 30, 60, 120] as const;
/** Interval at which a word counts as "thuộc vững" / long-term mastered. */
export const MASTERED_INTERVAL = 30;

export type WordReview = {
  mastered: boolean;
  correct_streak: number;
  next_review_at: string | null;
  /** 0 = never answered correctly; >0 = current SRS interval in days. */
  interval_days: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function quizWordKey(word: string, reading: string) {
  return `${word}|${reading}`;
}

/**
 * Words a learner is tested on for one entry. Kanji cards test their example
 * words; a phrase card (クッション言葉) is itself the thing tested.
 */
export function entryWordKeys(entry: VocabularyBookEntry, phraseBook: boolean): string[] {
  if (phraseBook) {
    return entry.mnemonic && entry.readings[0] ? [quizWordKey(entry.kanji, entry.readings[0])] : [];
  }
  return [
    ...new Set(
      entry.vocabulary
        .filter((word) => word.word && word.reading && word.meaning)
        .map((word) => quizWordKey(word.word, word.reading)),
    ),
  ];
}

export function isPassed(review: WordReview | undefined) {
  return (review?.interval_days ?? 0) > 0;
}

export function isDue(review: WordReview | undefined, now = Date.now()) {
  return (
    isPassed(review) &&
    (!review?.next_review_at || Date.parse(review.next_review_at) <= now)
  );
}

/**
 * Apply one answer to a word's SRS state.
 *
 * - First correct answer puts the word on the ladder (1 day).
 * - A correct answer on a due word climbs one rung.
 * - A correct answer before the word is due changes nothing: re-drilling the
 *   same word five times in one sitting must not push it out a month.
 * - A wrong answer drops a learned word back to 1 day (it stays "learned", so a
 *   finished plan day does not reopen); an unlearned word stays at 0.
 */
export function reviewWord(
  previous: WordReview | undefined,
  correct: boolean,
  now = new Date(),
): WordReview {
  const interval = previous?.interval_days ?? 0;
  const streak = correct ? (previous?.correct_streak ?? 0) + 1 : 0;
  if (correct && interval > 0 && !isDue(previous, now.getTime())) {
    return { ...previous!, correct_streak: streak };
  }
  const nextInterval = correct
    ? interval === 0
      ? SRS_LADDER[0]
      : (SRS_LADDER.find((step) => step > interval) ?? SRS_LADDER[SRS_LADDER.length - 1])
    : interval > 0
      ? SRS_LADDER[0]
      : 0;
  return {
    interval_days: nextInterval,
    correct_streak: streak,
    mastered: nextInterval >= MASTERED_INTERVAL,
    next_review_at: new Date(now.getTime() + Math.max(nextInterval, 1) * DAY_MS).toISOString(),
  };
}

export type PlanItem = {
  /** Position in the schedule; item i is planned for start_date + i days. */
  index: number;
  kind: "learn" | "review";
  /** 1-based week number. */
  week: number;
  /** 1-based learning-day number (review days repeat the week's last one). */
  day: number;
  entryIds: string[];
  wordCount: number;
  firstOrder: number;
  lastOrder: number;
};

function entryWeight(entry: VocabularyBookEntry, phraseBook: boolean) {
  return Math.max(1, entryWordKeys(entry, phraseBook).length);
}

export function totalWords(entries: VocabularyBookEntry[], phraseBook: boolean) {
  return entries.reduce((sum, entry) => sum + entryWeight(entry, phraseBook), 0);
}

/** Words per day needed to finish `weeks` weeks of six learning days. */
export function wordsPerDayForWeeks(entries: VocabularyBookEntry[], phraseBook: boolean, weeks: number) {
  return Math.max(1, Math.ceil(totalWords(entries, phraseBook) / (weeks * LEARN_DAYS_PER_WEEK)));
}

/** Cut entries into days of ~`wordsPerDay` words, closing each day at whichever entry boundary lands nearest the target. */
export function splitIntoDays(
  entries: VocabularyBookEntry[],
  phraseBook: boolean,
  wordsPerDay: number,
): VocabularyBookEntry[][] {
  const target = Math.max(1, wordsPerDay);
  const days: VocabularyBookEntry[][] = [];
  let current: VocabularyBookEntry[] = [];
  let sum = 0;
  for (const entry of entries) {
    const weight = entryWeight(entry, phraseBook);
    if (current.length > 0 && sum + weight - target > target - sum) {
      days.push(current);
      current = [];
      sum = 0;
    }
    current.push(entry);
    sum += weight;
    if (sum >= target) {
      days.push(current);
      current = [];
      sum = 0;
    }
  }
  if (current.length > 0) days.push(current);
  return days;
}

export function buildSchedule(
  entries: VocabularyBookEntry[],
  phraseBook: boolean,
  wordsPerDay: number,
): PlanItem[] {
  const days = splitIntoDays(entries, phraseBook, wordsPerDay);
  const items: PlanItem[] = [];
  let week: VocabularyBookEntry[][] = [];
  const pushReview = () => {
    const weekEntries = week.flat();
    items.push({
      index: items.length,
      kind: "review",
      week: Math.ceil(items.filter((item) => item.kind === "learn").length / LEARN_DAYS_PER_WEEK),
      day: items.filter((item) => item.kind === "learn").length,
      entryIds: weekEntries.map((entry) => entry.id),
      wordCount: weekEntries.reduce((sum, entry) => sum + entryWeight(entry, phraseBook), 0),
      firstOrder: weekEntries[0]?.order_index ?? 0,
      lastOrder: weekEntries.at(-1)?.order_index ?? 0,
    });
    week = [];
  };
  days.forEach((day, dayIndex) => {
    items.push({
      index: items.length,
      kind: "learn",
      week: Math.floor(dayIndex / LEARN_DAYS_PER_WEEK) + 1,
      day: dayIndex + 1,
      entryIds: day.map((entry) => entry.id),
      wordCount: day.reduce((sum, entry) => sum + entryWeight(entry, phraseBook), 0),
      firstOrder: day[0]?.order_index ?? 0,
      lastOrder: day.at(-1)?.order_index ?? 0,
    });
    week.push(day);
    if (week.length === LEARN_DAYS_PER_WEEK) pushReview();
  });
  // A trailing partial week still ends on a review day.
  if (week.length > 0) pushReview();
  return items;
}

export type PlanProgress = {
  /** Done flag per schedule item. */
  done: boolean[];
  /** First unfinished item — what "today" means for the learner. */
  currentIndex: number;
  /** Item the calendar says should be done today. */
  scheduledIndex: number;
  /** >0: learner is that many days behind the calendar. <0: ahead. */
  behind: number;
  completed: number;
  finished: boolean;
};

export function planProgress(args: {
  plan: Pick<VocabularyBookPlan, "start_date" | "reviews_done">;
  items: PlanItem[];
  entries: VocabularyBookEntry[];
  phraseBook: boolean;
  reviews: Map<string, WordReview>;
  learnedEntries: Map<string, boolean>;
  today?: string;
}): PlanProgress {
  const { plan, items, entries, phraseBook, reviews, learnedEntries } = args;
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const entryDone = (id: string) => {
    const entry = byId.get(id);
    if (!entry) return true;
    const keys = entryWordKeys(entry, phraseBook);
    return keys.length > 0 ? keys.every((key) => isPassed(reviews.get(key))) : (learnedEntries.get(id) ?? false);
  };
  const done = items.map((item) =>
    item.kind === "learn"
      ? item.entryIds.every(entryDone)
      : (plan.reviews_done ?? []).includes(item.week),
  );
  const firstOpen = done.indexOf(false);
  const currentIndex = firstOpen === -1 ? items.length : firstOpen;
  const scheduledIndex = Math.max(0, daysBetween(plan.start_date, args.today ?? todayKey()));
  return {
    done,
    currentIndex,
    scheduledIndex,
    behind: Math.min(scheduledIndex, items.length) - currentIndex,
    completed: done.filter(Boolean).length,
    finished: firstOpen === -1,
  };
}

export function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Start date that puts schedule item `index` on `today` — used to shift the plan after missed days. */
export function startDateFor(index: number, today = todayKey()) {
  return addDays(today, -index);
}

/** Weeks whose learning days are all done — reviews we can skip after re-pacing. */
export function reviewedWeeksAfterRepace(items: PlanItem[], done: boolean[]) {
  return items
    .filter((item, index) => item.kind === "review" && items.slice(0, index).every((prior, priorIndex) => prior.kind === "review" || done[priorIndex]))
    .map((item) => item.week);
}
