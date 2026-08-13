// Moments the companion should react to, as they happen.
//
// `nextCompanionAction` answers "what should you do next?" from a snapshot of
// state. That is the wrong shape for praise: congratulating someone needs to
// know that something JUST changed, which a snapshot cannot tell you. So the
// app emits an event at the moment of the change and the companion answers
// "what should I say about what you just did?".
//
// The bus is a module-level set rather than a React context on purpose: the
// emitter (the lesson player) and the listener (the companion, mounted up in
// the shell) are far apart in the tree, and threading a provider between them
// would touch every page for no gain.

export interface AttemptEvent {
  kind: "attempt";
  /** Did this recording clear the sentence's pass score? */
  passed: boolean;
  /** Score of this attempt, 0..100. */
  total: number;
  passScore: number;
  /** Points above the previous best; null when this is the first ever try. */
  improvedBy: number | null;
  /** First time this sentence is cleared today (i.e. it counted for the mission). */
  firstPassToday: boolean;
  /** Attempts on this sentence so far, including this one. */
  tries: number;
  lessonCompleted: boolean;
  missionCompleted: boolean;
  streakIncreased: boolean;
  currentStreak: number;
  leveledUp: boolean;
  newLevel: number;
}

/**
 * A 読解 lesson: the learner reads a passage and answers a comprehension check.
 * Nothing here is scored by voice, so the companion must not reach for any of
 * the shadowing lines ("record it again", "you passed the sentence") — reading
 * gets its own vocabulary of praise.
 */
export interface ReadingEvent {
  kind: "reading";
  /** Correct answers in the comprehension check. */
  correct: number;
  total: number;
  /** The lesson had not been marked read before this submission. */
  firstRead: boolean;
}

export interface VocabEvent {
  kind: "vocab";
  /** Words still unlearned in the notebook after this change. */
  left: number;
}

export type CompanionEvent = AttemptEvent | ReadingEvent | VocabEvent;

export type ReactionKey =
  | "readingPerfect"
  | "readingPassed"
  | "readingMissed"
  | "levelUp"
  | "lessonCleared"
  | "missionCleared"
  | "firstPass"
  | "newBest"
  | "nearPass"
  | "hardSentence"
  | "keepGoing"
  | "vocabCleared"
  | "vocabLearned";

/**
 * How loud a reaction is. Milestones always interrupt; chatter is throttled by
 * the companion so a run of failed takes does not turn into a stream of pop-ups.
 */
export type ReactionTier = "milestone" | "chatter";

export type Mood = "cheer" | "warm" | "calm";

export interface CompanionReaction {
  key: ReactionKey;
  tier: ReactionTier;
  mood: Mood;
  /** How long the bubble stays open, ms. */
  hold: number;
  level?: number;
  streak?: number;
  /** Points gained over the previous best (newBest). */
  delta?: number;
  /** Points still missing to pass (nearPass). */
  gap?: number;
  words?: number;
  /** Comprehension check result (reading*). */
  correct?: number;
  total?: number;
}

/** Within this many points of the pass score, "so close" is worth saying. */
const NEAR_PASS_GAP = 8;
/** Retries on one sentence before the companion stops cheering and reassures. */
const STRUGGLE_TRIES = 3;
/** Ignore improvements smaller than this: noise between two takes, not progress. */
const MIN_MEANINGFUL_GAIN = 3;

/**
 * What to say about an event, or null to stay quiet.
 *
 * The order below IS the product decision — one event can be several good
 * things at once (a take that passes the sentence, finishes the lesson AND
 * levels you up), and the companion says only the biggest of them. The smaller
 * wins are already listed in the player's inline celebration strip, so
 * repeating them here would just be noise on top of noise.
 */
export function reactionFor(event: CompanionEvent): CompanionReaction | null {
  if (event.kind === "vocab") {
    if (event.left === 0) {
      return { key: "vocabCleared", tier: "milestone", mood: "cheer", hold: 7_000 };
    }
    return {
      key: "vocabLearned",
      tier: "chatter",
      mood: "warm",
      hold: 5_000,
      words: event.left,
    };
  }

  if (event.kind === "reading") {
    const { correct, total } = event;
    // Re-reading a lesson already marked read is worth a nod, not a fanfare.
    const tier: ReactionTier = event.firstRead ? "milestone" : "chatter";
    // Finishing the passage is the milestone; the score decides the tone. Even
    // a weak score points forward (reread the paragraph) rather than scolding —
    // a comprehension check is not something you can "retake" for a better XP.
    if (correct >= total) {
      return {
        key: "readingPerfect",
        tier,
        mood: "cheer",
        hold: 8_000,
        correct,
        total,
      };
    }
    if (correct * 2 >= total) {
      return {
        key: "readingPassed",
        tier,
        mood: "cheer",
        hold: 8_000,
        correct,
        total,
      };
    }
    return {
      key: "readingMissed",
      tier,
      mood: "calm",
      hold: 9_000,
      correct,
      total,
    };
  }

  if (event.leveledUp) {
    return {
      key: "levelUp",
      tier: "milestone",
      mood: "cheer",
      hold: 9_000,
      level: event.newLevel,
    };
  }
  if (event.lessonCompleted) {
    return { key: "lessonCleared", tier: "milestone", mood: "cheer", hold: 8_000 };
  }
  if (event.missionCompleted) {
    return {
      key: "missionCleared",
      tier: "milestone",
      mood: "cheer",
      hold: 8_000,
      streak: event.currentStreak,
    };
  }

  if (event.passed) {
    // A sentence already cleared today, re-recorded with no real gain, is not
    // news. Staying silent here is what keeps the praise worth something.
    if (event.firstPassToday) {
      return { key: "firstPass", tier: "chatter", mood: "cheer", hold: 5_000 };
    }
    if (event.improvedBy != null && event.improvedBy >= MIN_MEANINGFUL_GAIN) {
      return {
        key: "newBest",
        tier: "chatter",
        mood: "cheer",
        hold: 5_000,
        delta: event.improvedBy,
      };
    }
    return null;
  }

  // Missed. Past a few tries the useful thing is not another "almost!" but
  // permission to slow down or move on.
  if (event.tries >= STRUGGLE_TRIES) {
    return { key: "hardSentence", tier: "chatter", mood: "calm", hold: 7_000 };
  }
  const gap = Math.max(1, Math.round(event.passScore - event.total));
  if (gap <= NEAR_PASS_GAP) {
    return { key: "nearPass", tier: "chatter", mood: "warm", hold: 6_000, gap };
  }
  if (event.improvedBy != null && event.improvedBy >= MIN_MEANINGFUL_GAIN) {
    return {
      key: "newBest",
      tier: "chatter",
      mood: "warm",
      hold: 5_000,
      delta: event.improvedBy,
    };
  }
  return { key: "keepGoing", tier: "chatter", mood: "warm", hold: 6_000 };
}

type Listener = (event: CompanionEvent) => void;

const listeners = new Set<Listener>();

export function emitCompanionEvent(event: CompanionEvent): void {
  // Copy first: a listener that unsubscribes while reacting must not skip the
  // next one in the set.
  for (const listener of [...listeners]) listener(event);
}

export function onCompanionEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
