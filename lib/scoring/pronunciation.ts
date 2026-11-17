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
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(/[\p{P}\p{S}]/gu, "")
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
  /** Weighted mismatch cost (see `mismatchCost`). */
  errorCost?: number;
  /** Cost the sentence may absorb and still reach the pass gate (91). */
  tolerance?: number;
}

/**
 * Stands in for a Latin word without a known reading (see kana.ts). Private-use
 * code point, so normalizeJa keeps it and it is one mora token.
 */
export const LATIN_WILDCARD = "\uE000";
const MAX_WILDCARD_SPAN = 12;

/**
 * Let a wildcard slot absorb the learner's rendering of that word: the
 * recognised mora right around it become matches instead of extras.
 */
export function absorbWildcards(alignment: ScoreAlignmentToken[]): ScoreAlignmentToken[] {
  const out = alignment.map((t) => ({ ...t }));
  out.forEach((token, w) => {
    if (token.target !== LATIN_WILDCARD) return;
    let absorbed = 0;
    for (const step of [-1, 1]) {
      for (let i = w + step; i >= 0 && i < out.length && absorbed < MAX_WILDCARD_SPAN; i += step) {
        if (out[i].status !== "extra") break;
        out[i].status = "match";
        absorbed++;
      }
    }
    if (token.status === "substitution" || (token.status === "missing" && absorbed > 0)) {
      token.status = "match";
    }
  });
  return out;
}

const SPECIAL_MORA = new Set(["ッ", "ー", "ン"]);
const VOWELS = new Set(["ア", "イ", "ウ", "エ", "オ"]);
// Same sound, different spelling — a recogniser/orthography artefact, not a
// pronunciation error.
const HOMOPHONES = [["ヅ", "ズ"], ["ヂ", "ジ"], ["ヲ", "オ"], ["ヮ", "ワ"]];

/**
 * Cost of one alignment step. Browser STT routinely drops or adds the "special"
 * mora (ッ ー ン) and spells long vowels either as ー or as a vowel kana, so
 * those count half/quarter instead of a full error. Everything else is 1.
 */
export function mismatchCost(token: ScoreAlignmentToken): number {
  if (token.status === "match") return 0;
  const unit = token.target ?? token.spoken ?? "";
  if (token.status === "missing" || token.status === "extra") {
    return SPECIAL_MORA.has(unit) ? 0.5 : 1;
  }
  const a = token.target ?? "";
  const b = token.spoken ?? "";
  if ((a === "ー" && VOWELS.has(b)) || (b === "ー" && VOWELS.has(a))) return 0.25;
  if (HOMOPHONES.some(([x, y]) => (a === x && b === y) || (a === y && b === x))) return 0.25;
  if (SPECIAL_MORA.has(a) && SPECIAL_MORA.has(b)) return 0.5;
  return 1;
}

/**
 * How much mismatch a sentence of `length` mora may absorb and still pass.
 * A fixed similarity bar made any single slip fail every sentence under ~14
 * mora, i.e. most beginner sentences. Very short utterances (はい, いいえ) still
 * only forgive an STT-confusable slip, never a real wrong sound.
 */
export function errorTolerance(length: number): number {
  if (length <= 0) return 0;
  return length < 6 ? 0.5 : Math.max(1, length / 12);
}

/**
 * Accuracy 0..100 from weighted mismatch cost. Within tolerance the score maps
 * linearly to 100..91 (the pass gate); beyond it it follows the old curve but
 * is capped at 90 so it can never pass.
 */
export function accuracyFromCost(cost: number, length: number): number {
  if (length <= 0) return 0;
  if (cost <= 0) return 100;
  const tolerance = errorTolerance(length);
  if (cost <= tolerance) return Math.round(100 - (9 * cost) / tolerance);
  const sim = Math.max(0, 1 - cost / length);
  return Math.min(90, Math.round(Math.pow(sim, 1.2) * 100));
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
  const alignment = absorbWildcards(alignMoraTokens(a, b));
  if (target.length === 0) return { pronunciation: 0, coverage: 0, alignment };

  // Coverage = share of the target that was voiced at all. Omitted special
  // mora only half-count, consistent with `mismatchCost`.
  const missingCost = alignment
    .filter((token) => token.status === "missing")
    .reduce((sum, token) => sum + mismatchCost(token), 0);
  const coverage = Math.max(0, 1 - missingCost / target.length);
  // Weighted cost along the alignment path; a long run of extra speech can
  // still never pass because every extra non-special mora costs 1.
  const errorCost = alignment.reduce((sum, token) => sum + mismatchCost(token), 0);

  return {
    pronunciation: clamp(accuracyFromCost(errorCost, target.length)),
    coverage: clamp(Math.round(coverage * 100)),
    alignment,
    errorCost,
    tolerance: errorTolerance(target.length),
  };
}

/** Backward-compatible helper for callers that only need the accuracy score. */
export function scorePronunciation(input: PronunciationInput): number {
  return scorePronunciationDetailed(input).pronunciation;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
