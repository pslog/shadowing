// Full-lesson shadowing: one continuous transcript scored against the whole
// lesson, then split back per sentence for a heat map. Pure + isomorphic.

import {
  absorbWildcards,
  accuracyFromCost,
  alignMoraTokens,
  mismatchCost,
  moraTokens,
} from "./pronunciation";

export const MIN_ACCURACY_GREEN = 91;
export const MIN_COVERAGE_GREEN = 80;
export const MIN_COVERAGE_YELLOW = 50;

export type SentenceRunStatus = "good" | "partial" | "missed";

export interface SentenceRunResult {
  index: number;
  accuracy: number;
  coverage: number;
  status: SentenceRunStatus;
  /** Recognised mora that landed in this sentence (for display). */
  spoken: string;
}

export interface LessonRunScore {
  sentences: SentenceRunResult[];
  /** Mora-weighted accuracy over the whole lesson, 0..100. */
  accuracy: number;
  /** Mora-weighted coverage over the whole lesson, 0..100. */
  coverage: number;
}

/**
 * @param sentenceReadings katakana reading per sentence, in lesson order
 * @param spokenReading    katakana reading of the whole run's transcript
 */
export function scoreLessonRun(sentenceReadings: string[], spokenReading: string): LessonRunScore {
  const perSentence = sentenceReadings.map((r) => moraTokens(r));
  // Sentence index for each target mora, in order.
  const owner: number[] = [];
  perSentence.forEach((tokens, i) => tokens.forEach(() => owner.push(i)));
  const joined = perSentence.map((t) => t.join("")).join("");
  const alignment = absorbWildcards(alignMoraTokens(joined, spokenReading));

  const cost = sentenceReadings.map(() => 0);
  const missing = sentenceReadings.map(() => 0);
  const spoken = sentenceReadings.map(() => "");
  let targetSeen = 0;
  let lastOwner = 0;
  for (const token of alignment) {
    // Extras belong to the sentence being spoken at that point.
    const at = token.target != null ? (owner[targetSeen] ?? lastOwner) : lastOwner;
    if (token.target != null) {
      targetSeen++;
      lastOwner = at;
    }
    const c = mismatchCost(token);
    cost[at] += c;
    if (token.status === "missing") missing[at] += c;
    if (token.spoken) spoken[at] += token.spoken;
  }

  let weightSum = 0;
  let accSum = 0;
  let covSum = 0;
  const sentences = perSentence.map((tokens, index): SentenceRunResult => {
    const len = tokens.length;
    const accuracy = len ? accuracyFromCost(cost[index], len) : 100;
    const coverage = len ? Math.round(Math.max(0, 1 - missing[index] / len) * 100) : 100;
    weightSum += len;
    accSum += accuracy * len;
    covSum += coverage * len;
    const status: SentenceRunStatus =
      accuracy >= MIN_ACCURACY_GREEN && coverage >= MIN_COVERAGE_GREEN
        ? "good"
        : coverage >= MIN_COVERAGE_YELLOW
          ? "partial"
          : "missed";
    return { index, accuracy, coverage, status, spoken: spoken[index] };
  });
  return {
    sentences,
    accuracy: weightSum ? Math.round(accSum / weightSum) : 0,
    coverage: weightSum ? Math.round(covSum / weightSum) : 0,
  };
}

/**
 * Final lesson score: content accuracy leads, keeping up with the audio is the
 * shadowing-specific part. `keptUp` is the share of sentences (0..1) during
 * which the learner was voicing.
 */
export function lessonRunTotal(accuracy: number, keptUp: number | null): number {
  if (keptUp == null) return accuracy;
  return Math.round(0.75 * accuracy + 0.25 * Math.max(0, Math.min(1, keptUp)) * 100);
}
