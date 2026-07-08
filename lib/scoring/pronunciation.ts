// Pronunciation scoring.
//
// Real STT (Web Speech API, ja-JP) gives us `spokenText`; we compare it to the
// target sentence with a normalized Levenshtein similarity. When no transcript
// is available (unsupported browser / STT failed) we fall back to a realistic
// random score so the flow stays testable.
//
// This module is intentionally pure + dependency-free so it can later be
// replaced by a call to a real pronunciation-assessment API.

/** Normalize Japanese text for comparison: drop spaces & common punctuation. */
export function normalizeJa(text: string): string {
  return text
    .replace(/[\s　]/g, "")
    .replace(/[。、！？!?.,・「」『』（）()~〜ー]/g, "")
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
  /** Deterministic seed (0..1) used only for the mock fallback. */
  seed?: number;
}

/**
 * Returns a 0..100 pronunciation score.
 * - With a transcript: similarity mapped to 40..100 (a partly-correct utterance
 *   still earns credit; a perfect match caps at 100).
 * - Without a transcript: realistic mock in 60..95.
 */
export function scorePronunciation({
  targetText,
  spokenText,
  seed,
}: PronunciationInput): number {
  const spoken = (spokenText ?? "").trim();
  if (!spoken) {
    return mock(60, 95, seed);
  }
  const sim = similarity(targetText, spoken);
  // Map similarity 0..1 -> 40..100 with a mild curve rewarding closeness.
  const score = 40 + Math.pow(sim, 0.85) * 60;
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
