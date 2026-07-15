// Scoring orchestrator. Pure + isomorphic so it can run in the /api/score
// route today and be swapped for a real AI pronunciation API tomorrow.

import { scorePronunciationDetailed } from "./pronunciation";
import { scoreSpeed } from "./speed";
import { scoreIntonation } from "./intonation";
import { scoreTotal } from "./total";
import { generateFeedback } from "./feedback";
import type { ScoreBreakdown } from "@/lib/types";

export interface ScoreRequest {
  targetText: string;
  spokenText?: string | null;
  /** Katakana readings, precomputed server-side (see lib/scoring/kana.ts). */
  targetReading?: string | null;
  spokenReading?: string | null;
  originalDurationSeconds?: number | null;
  userDurationSeconds?: number | null;
  /** Pitch-contour similarity 0..1 from the client, or null if not measured. */
  intonationSimilarity?: number | null;
  passScore?: number;
}

const MIN_PRONUNCIATION_TO_PASS = 75;
const MIN_COVERAGE_TO_PASS = 80;

export function scoreAttempt(req: ScoreRequest): ScoreBreakdown {
  const passScore = req.passScore ?? 80;

  const hasTranscript = Boolean(req.spokenText?.trim());
  // Seed is only used by speed when reference/user timing is missing.
  const seedB = seedFrom(req.targetText, 2);

  const { pronunciation, coverage, alignment } = scorePronunciationDetailed({
    targetText: req.targetText,
    spokenText: req.spokenText,
    targetReading: req.targetReading,
    spokenReading: req.spokenReading,
  });
  const speed = scoreSpeed({
    originalDurationSeconds: req.originalDurationSeconds,
    userDurationSeconds: req.userDurationSeconds,
    seed: seedB,
  });
  const intonation = scoreIntonation({ similarity: req.intonationSimilarity });
  const total = scoreTotal(pronunciation, speed, intonation);
  const passed =
    hasTranscript &&
    total >= passScore &&
    pronunciation >= MIN_PRONUNCIATION_TO_PASS &&
    coverage >= MIN_COVERAGE_TO_PASS;

  return {
    pronunciation,
    speed,
    coverage,
    alignment,
    intonation,
    total,
    passed,
    feedback: generateFeedback({
      pronunciation,
      speed,
      coverage,
      intonation,
      total,
      hasTranscript,
    }),
  };
}

// Deterministic 0..1 seed derived from text + salt (stable per sentence, so
// mock scores don't jump wildly between renders but still vary per sentence).
function seedFrom(text: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export * from "./pronunciation";
export * from "./speed";
export * from "./intonation";
export * from "./total";
export * from "./feedback";
