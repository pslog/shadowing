// Pronunciation scoring.
//
// Real STT (Web Speech API, ja-JP) gives us `spokenText`; we compare it to the
// target sentence with a normalized Levenshtein similarity. When no transcript
// is available (unsupported browser / STT failed) we fall back to a realistic
// random score so the flow stays testable.
//
// This module is intentionally pure + dependency-free so it can later be
// replaced by a call to a real pronunciation-assessment API.

/**
 * Normalize Japanese text for comparison: drop spaces & punctuation, fold
 * full-width ASCII to half-width, and fold hiragana -> katakana so that kana
 * differences ("わたし" vs "ワタシ") never count as errors. When comparing kana
 * *readings* this makes the metric purely phonetic.
 */
export function normalizeJa(text: string): string {
  return text
    .replace(/[\s　]/g, "")
    .replace(/[。、！？!?.,・「」『』（）()~〜ー－「」]/g, "")
    // full-width ASCII digits/letters -> half-width
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    // hiragana -> katakana (unify kana scripts)
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .trim();
}

/** Levenshtein edit distance between two strings (character level). */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Similarity in 0..1 based on normalized edit distance. */
export function similarity(a: string, b: string): number {
  const na = normalizeJa(a);
  const nb = normalizeJa(b);
  if (na.length === 0 && nb.length === 0) return 1;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length) || 1;
  return Math.max(0, 1 - dist / maxLen);
}

export interface PronunciationInput {
  targetText: string;
  spokenText?: string | null;
  /**
   * Katakana readings (from a morphological analyzer). When both are present
   * the comparison is phonetic — the correct, reliable path. Falls back to
   * comparing the raw text (kana-folded) when readings are unavailable.
   */
  targetReading?: string | null;
  spokenReading?: string | null;
  /** Deterministic seed (0..1) used only for the mock fallback. */
  seed?: number;
}

/**
 * Returns a 0..100 pronunciation score.
 * - With a transcript: similarity mapped straight to 0..100 with a *penalizing*
 *   curve (exponent > 1) so a partly-wrong utterance loses real points and only
 *   a near-perfect match reaches the pass zone. No artificial floor — saying
 *   something completely different scores near zero.
 * - Without a transcript (unsupported browser / STT failed): modest mock so the
 *   flow stays usable, but not high enough to coast to a pass on its own.
 */
export function scorePronunciation({
  targetText,
  spokenText,
  targetReading,
  spokenReading,
  seed,
}: PronunciationInput): number {
  const spoken = (spokenText ?? "").trim();
  if (!spoken) {
    return mock(55, 80, seed);
  }
  // Prefer phonetic (reading) comparison; fall back to raw text.
  const a = targetReading && targetReading.length ? targetReading : targetText;
  const b = spokenReading && spokenReading.length ? spokenReading : spoken;
  const sim = similarity(a, b);
  // Map similarity 0..1 -> 0..100 with a curve that punishes divergence.
  // sim 1.0->100, 0.9->87, 0.8->75, 0.7->63, 0.6->52, 0.5->41, 0->0.
  const score = Math.pow(sim, 1.3) * 100;
  return clamp(Math.round(score));
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function mock(min: number, max: number, seed?: number): number {
  const r = seed ?? pseudoRandom();
  return Math.round(min + r * (max - min));
}

// Cheap deterministic-ish randomness; callers may pass an explicit seed.
function pseudoRandom(): number {
  return Math.abs(Math.sin(Date.now() * 0.001)) % 1;
}
