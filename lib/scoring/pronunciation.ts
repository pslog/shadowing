// Pronunciation scoring.
//
// Real STT (Web Speech API, ja-JP) gives us `spokenText`; we compare it to the
// target sentence with mora-like kana alignment. No transcript means no score:
// a browser/STT failure should not be able to pass a shadowing attempt.
//
// This module is intentionally pure + dependency-free so it can later be
// replaced by a call to a real pronunciation-assessment API.

import type { ScoreAlignmentToken } from "@/lib/types";

/**
 * Normalize Japanese text for comparison: drop spaces & punctuation, fold
 * full-width ASCII to half-width, and fold hiragana -> katakana so that kana
 * differences ("わたし" vs "ワタシ") never count as errors. Long vowel marks are
 * kept because they matter for Japanese pronunciation.
 */
export function normalizeJa(text: string): string {
  return text
    .replace(/[\s　]/g, "")
    .replace(/[。、！？!?.,・「」『』（）()~〜－「」]/g, "")
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

/** Similarity in 0..1 based on normalized character edit distance. */
export function similarity(a: string, b: string): number {
  const na = normalizeJa(a);
  const nb = normalizeJa(b);
  if (na.length === 0 && nb.length === 0) return 1;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length) || 1;
  return Math.max(0, 1 - dist / maxLen);
}

const SMALL_KANA = new Set("ァィゥェォャュョヮぁぃぅぇぉゃゅょゎ".split(""));

/**
 * Approximate Japanese mora units from normalized kana. Small kana attach to
 * the previous unit; ッ and ー remain explicit units because they are important
 * shadowing targets. This is intentionally lightweight for browser/STT scoring.
 */
export function moraTokens(text: string): string[] {
  const chars = Array.from(normalizeJa(text));
  const out: string[] = [];
  for (const ch of chars) {
    if (SMALL_KANA.has(ch) && out.length > 0) {
      out[out.length - 1] += ch;
    } else {
      out.push(ch);
    }
  }
  return out;
}

function levenshteinTokens(a: string[], b: string[]): number {
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

function lcsLength(a: string[], b: string[]): number {
  const n = b.length;
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1] + 1
          : Math.max(prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return prev[n];
}

export function alignMoraTokens(
  targetText: string,
  spokenText: string,
): ScoreAlignmentToken[] {
  const target = moraTokens(targetText);
  const spoken = moraTokens(spokenText);
  const m = target.length;
  const n = spoken.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = target[i - 1] === spoken[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  const out: ScoreAlignmentToken[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      dp[i][j] === dp[i - 1][j - 1] + (target[i - 1] === spoken[j - 1] ? 0 : 1)
    ) {
      out.push({
        target: target[i - 1],
        spoken: spoken[j - 1],
        status: target[i - 1] === spoken[j - 1] ? "match" : "substitution",
      });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      out.push({ target: target[i - 1], spoken: null, status: "missing" });
      i--;
    } else if (j > 0) {
      out.push({ target: null, spoken: spoken[j - 1], status: "extra" });
      j--;
    }
  }

  return out.reverse();
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
}

export interface PronunciationResult {
  pronunciation: number;
  coverage: number;
  alignment: ScoreAlignmentToken[];
}

/**
 * Returns pronunciation and target coverage, both 0..100.
 * Pronunciation penalizes substitutions, omissions, and insertions. Coverage
 * focuses on how much of the target was actually spoken, so short partial
 * utterances cannot pass just because the spoken fragment was recognized well.
 */
export function scorePronunciationDetailed({
  targetText,
  spokenText,
  targetReading,
  spokenReading,
}: PronunciationInput): PronunciationResult {
  const spoken = (spokenText ?? "").trim();
  if (!spoken) {
    const targetForAlignment =
      targetReading && targetReading.length ? targetReading : targetText;
    return {
      pronunciation: 0,
      coverage: 0,
      alignment: alignMoraTokens(targetForAlignment, ""),
    };
  }
  // Prefer phonetic (reading) comparison; fall back to raw text.
  const a = targetReading && targetReading.length ? targetReading : targetText;
  const b = spokenReading && spokenReading.length ? spokenReading : spoken;
  const target = moraTokens(a);
  const utterance = moraTokens(b);
  const alignment = alignMoraTokens(a, b);
  if (target.length === 0) return { pronunciation: 0, coverage: 0, alignment };

  const dist = levenshteinTokens(target, utterance);
  const sim = Math.max(0, 1 - dist / Math.max(target.length, utterance.length, 1));
  const coverage = lcsLength(target, utterance) / target.length;

  // Slightly penalizing, but less harsh than the old character-level curve
  // because mora units already make omissions/insertions more visible.
  return {
    pronunciation: clamp(Math.round(Math.pow(sim, 1.2) * 100)),
    coverage: clamp(Math.round(coverage * 100)),
    alignment,
  };
}

/** Backward-compatible helper for callers that only need the accuracy score. */
export function scorePronunciation(input: PronunciationInput): number {
  return scorePronunciationDetailed(input).pronunciation;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
