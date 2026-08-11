// Short, encouraging feedback. One message only to avoid overwhelming users.

import { DEFAULT_LOCALE, type Locale, messages } from "@/lib/i18n";

export interface FeedbackScores {
  pronunciation: number;
  speed: number;
  coverage: number;
  /** null when intonation could not be measured — excluded from the advice. */
  intonation: number | null;
  total: number;
  hasTranscript?: boolean;
  /** Locale of the learner at the time of the attempt. */
  locale?: Locale;
}

const MIN_PRONUNCIATION_FOR_PASS = 91;

export function generateFeedback({
  pronunciation,
  speed,
  coverage,
  intonation,
  total,
  hasTranscript = true,
  locale = DEFAULT_LOCALE,
}: FeedbackScores): string {
  const t = (messages[locale] ?? messages[DEFAULT_LOCALE]).score;

  if (!hasTranscript) return t.feedbackNoTranscript;
  if (coverage < 80) return t.feedbackCoverage;
  if (pronunciation < MIN_PRONUNCIATION_FOR_PASS) return t.feedbackPronunciation;
  if (total >= 90) return t.feedbackGreat;
  if (total >= 80) return t.feedbackPassed;

  // Only coach on dimensions we actually measured.
  const dims: Array<{ key: "pron" | "speed" | "inton"; value: number }> = [
    { key: "pron", value: pronunciation },
    { key: "speed", value: speed },
  ];
  if (intonation != null) dims.push({ key: "inton", value: intonation });
  const lowest = dims.reduce((a, b) => (b.value < a.value ? b : a));

  if (lowest.key === "pron") return t.feedbackLowPronunciation;
  if (lowest.key === "speed") return t.feedbackLowSpeed;
  return t.feedbackLowIntonation;
}

/** Extra nudge shown under the score when the user is close but failed. */
export function almostFeedback(
  total: number,
  passScore: number,
  pronunciation?: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const t = (messages[locale] ?? messages[DEFAULT_LOCALE]).score;
  if (
    typeof pronunciation === "number" &&
    pronunciation < MIN_PRONUNCIATION_FOR_PASS
  ) {
    return t.almostRetry;
  }
  return t.almostGap(passScore - total);
}
