// Scoring orchestrator. Pure + isomorphic so it can run in the /api/score
// route today and be swapped for a real AI pronunciation API tomorrow.

import { scorePronunciation } from "./pronunciation";
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

export function scoreAttempt(req: ScoreRequest): ScoreBreakdown {
  const passScore = req.passScore ?? 80;

  // Independent seeds so mock fallbacks don't all move together.
  const seedA = seedFrom(req.targetText, 1);
  const seedB = seedFrom(req.targetText, 2);

  const pronunciation = scorePronunciation({
    targetText: req.targetText,
    spokenText: req.spokenText,
    targetReading: req.targetReading,
    spokenReading: req.spokenReading,
    seed: seedA,
  });
  const speed = scoreSpeed({
    originalDurationSeconds: req.originalDurationSeconds,
    userDurationSeconds: req.userDurationSeconds,
    seed: seedB,
  });
  const intonation = scoreIntonation({ similarity: req.intonationSimilarity });
  const total = scoreTotal(pronunciation, speed, intonation);

  return {
    pronunciation,
    speed,
    intonation,
    total,
    passed: total >= passScore,
    feedback: generateFeedback({ pronunciation, speed, intonation, total }),
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
