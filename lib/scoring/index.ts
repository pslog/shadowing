// Scoring orchestrator. Pure + isomorphic so it can run in the /api/score
// route today and be swapped for a real AI pronunciation API tomorrow.

import { normalizeJa, scorePronunciationDetailed } from "./pronunciation";
import { scoreSpeed, speedDelta } from "./speed";
import { starsFor } from "./stars";
import { buildTips } from "./tips";
import { scoreIntonation } from "./intonation";
import { scoreTotal } from "./total";
import { generateFeedback } from "./feedback";
import type { ScoreBreakdown } from "@/lib/types";
import { isLocale, type Locale } from "@/lib/i18n";

export interface ScoreRequest {
  targetText: string;
  spokenText?: string | null;
  /**
   * Other recogniser hypotheses for the same audio (n-best). The route scores
   * each and keeps the best; scoreAttempt itself only scores `spokenText`.
   */
  spokenAlternatives?: string[] | null;
  /** Katakana readings, precomputed server-side (see lib/scoring/kana.ts). */
  targetReading?: string | null;
  spokenReading?: string | null;
  originalDurationSeconds?: number | null;
  userDurationSeconds?: number | null;
  /** Pitch-contour similarity 0..1 from the client, or null if not measured. */
  intonationSimilarity?: number | null;
  passScore?: number;
  /** Locale the coaching feedback string is generated in. */
  locale?: Locale;
  audioEvidence?: { duration: number; activeSeconds: number; clippedFraction: number; voicedSeconds: number };
}

export class UnscorableError extends Error {
  constructor(public code: string) { super(code); }
}

const MIN_PRONUNCIATION_TO_PASS = 91;
const MIN_COVERAGE_TO_PASS = 80;

export function scoreAttempt(req: ScoreRequest): ScoreBreakdown {
  const passScore = req.passScore ?? 80;
  if (!Number.isFinite(passScore) || passScore < 1 || passScore > 100) throw new UnscorableError("invalid_threshold");

  const hasTranscript = Boolean(req.spokenText?.trim());
  if (!hasTranscript) throw new UnscorableError("no_transcript");
  const audio = req.audioEvidence;
  if (!audio || !Number.isFinite(audio.duration) || !Number.isFinite(audio.activeSeconds) || !Number.isFinite(audio.clippedFraction) || !Number.isFinite(audio.voicedSeconds) || audio.voicedSeconds < 0.12 || audio.voicedSeconds > audio.duration || audio.duration <= 0 || audio.activeSeconds < 0.2 || audio.activeSeconds > audio.duration || audio.clippedFraction < 0 || audio.clippedFraction > 0.1) {
    throw new UnscorableError("unreliable_audio");
  }
  if (!req.targetReading || !req.spokenReading) throw new UnscorableError("reading_unavailable");
  if (![req.targetReading, req.spokenReading].every((reading) => /^[ァ-ヺー\uE000]+$/u.test(normalizeJa(reading)))) {
    throw new UnscorableError("ambiguous_reading");
  }

  const { pronunciation, coverage, alignment } = scorePronunciationDetailed({
    targetText: req.targetText,
    spokenText: req.spokenText,
    targetReading: req.targetReading,
    spokenReading: req.spokenReading,
  });
  const speed = scoreSpeed({
    originalDurationSeconds: req.originalDurationSeconds,
    userDurationSeconds: req.userDurationSeconds,

  });
  const intonation = scoreIntonation({ similarity: req.intonationSimilarity });
  const rawTotal = scoreTotal(pronunciation, coverage, speed, intonation);
  const total =
    pronunciation >= MIN_PRONUNCIATION_TO_PASS
      ? rawTotal
      : Math.min(rawTotal, passScore - 1);
  const passed =
    hasTranscript &&
    total >= passScore &&
    pronunciation >= MIN_PRONUNCIATION_TO_PASS &&
    coverage >= MIN_COVERAGE_TO_PASS;

  const tips = buildTips(alignment, speedDelta(req.originalDurationSeconds, req.userDurationSeconds));
  const stars = starsFor({ passed, pronunciation, speed, intonation, total });
  return {
    scoringVersion: "transcript-v2",
    confidence: "limited",
    limitations: ["speech_recognition_proxy", ...(speed == null ? ["no_reference_timing"] : []), ...(intonation == null ? ["no_pitch_comparison"] : [])],
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
      passed,
      // The request crosses the API boundary as JSON, so validate rather than
      // trusting the field's declared type.
      locale: isLocale(req.locale) ? req.locale : undefined,
    }),
    stars,
    tips,
    chosenTranscript: req.spokenText ?? undefined,
  };
}

export * from "./pronunciation";
export * from "./speed";
export * from "./intonation";
export * from "./total";
export * from "./feedback";
export * from "./stars";
export * from "./tips";
