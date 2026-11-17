import { NextResponse } from "next/server";
import { scoreAttempt, UnscorableError, type ScoreRequest } from "@/lib/scoring";
import { LATIN_WILDCARD } from "@/lib/scoring/pronunciation";
import { toReadingTokens, type ReadingToken } from "@/lib/scoring/kana";
import type { ScoreAlignmentToken, ScoreBreakdown } from "@/lib/types";

export const runtime = "nodejs";

// POST /api/score
// Body: { targetText, spokenText?, originalDurationSeconds?, userDurationSeconds?, passScore? }
//
// Today this runs the rule-based scoring engine. It is the single seam where a
// real AI pronunciation-assessment provider would be wired in — the request /
// response contract stays identical.
export async function POST(request: Request) {
  let body: ScoreRequest;
  try {
    body = (await request.json()) as ScoreRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.targetText || typeof body.targetText !== "string" || body.targetText.length > 1000 || (body.spokenText != null && (typeof body.spokenText !== "string" || body.spokenText.length > 1000))) {
    return NextResponse.json(
      { error: "targetText is required" },
      { status: 400 },
    );
  }
  for (const key of ["originalDurationSeconds", "userDurationSeconds", "intonationSimilarity", "passScore"] as const) {
    const value = body[key];
    if (value != null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 ||
      (key === "passScore" && (value < 1 || value > 100)) ||
      (key === "intonationSimilarity" && value > 1))) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
  }

  const alternatives = body.spokenAlternatives;
  if (alternatives != null && (!Array.isArray(alternatives) || alternatives.length > MAX_ALTERNATIVES ||
    alternatives.some((alt) => typeof alt !== "string" || alt.length > 1000))) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // Convert both sides to katakana readings so pronunciation is scored
  // phonetically (kanji vs kana from STT no longer counts as an error). If the
  // tokenizer is unavailable, toReading returns null and scoring is refused.
  const targetTokens = await toReadingTokens(body.targetText);
  const joinReadings = (tokens: ReadingToken[] | null) =>
    tokens?.map((tok) => tok.reading).join("").replace(/\uE000+/g, LATIN_WILDCARD) ?? null;
  const targetReading = joinReadings(targetTokens);

  // Browser STT returns an n-best list; its top hypothesis is often a
  // near-homophone of what was actually said. Score every hypothesis of the
  // same recording and keep the best one, as constrained pronunciation
  // assessment does. The primary transcript is always a candidate, so a single
  // hypothesis behaves exactly as before.
  const candidates = [...new Set([body.spokenText ?? "", ...(alternatives ?? [])].map((t) => t.trim()))]
    .filter((text, i) => i === 0 || text.length > 0);

  let best: { result: ScoreBreakdown; tokens: ReadingToken[] | null } | null = null;
  let firstError: unknown = null;
  for (const spokenText of candidates) {
    const spokenTokens = spokenText ? await toReadingTokens(spokenText) : [];
    const spokenReading = joinReadings(spokenTokens);
    try {
      const result = scoreAttempt({ ...body, spokenText, targetReading, spokenReading });
      if (!best || rank(result) > rank(best.result)) best = { result, tokens: spokenTokens };
    } catch (error) {
      if (!(error instanceof UnscorableError)) throw error;
      firstError ??= error;
    }
  }
  if (!best) {
    const code = firstError instanceof UnscorableError ? firstError.code : "no_transcript";
    return NextResponse.json({ error: code }, { status: 422 });
  }
  return NextResponse.json({
    ...best.result,
    textAlignment:
      targetTokens && best.tokens
        ? alignReadingTokens(targetTokens, best.tokens)
        : undefined,
  });
}

const MAX_ALTERNATIVES = 8;

// A Latin-word wildcard in the target accepts any one spoken word for display.
function sameReading(target: ReadingToken, spoken: ReadingToken): boolean {
  return target.reading === spoken.reading || target.reading.includes(LATIN_WILDCARD);
}

function rank(s: ScoreBreakdown): number {
  return (s.passed ? 1_000_000 : 0) + s.total * 1_000 + s.pronunciation;
}

function alignReadingTokens(
  target: ReadingToken[],
  spoken: ReadingToken[],
): ScoreAlignmentToken[] {
  // Token boundaries can differ despite identical normalized readings. Do not
  // show a red word-level mismatch when the mora-level comparison is exact.
  if (target.map((t) => t.reading).join("") === spoken.map((t) => t.reading).join("")) {
    return [{ target: target.map((t) => t.surface).join(""), spoken: spoken.map((t) => t.surface).join(""), status: "match" }];
  }
  const m = target.length;
  const n = spoken.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = sameReading(target[i - 1], spoken[j - 1]) ? 0 : 1;
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
      dp[i][j] ===
        dp[i - 1][j - 1] +
          (sameReading(target[i - 1], spoken[j - 1]) ? 0 : 1)
    ) {
      out.push({
        target: target[i - 1].surface,
        spoken: spoken[j - 1].surface,
        status:
          sameReading(target[i - 1], spoken[j - 1])
            ? "match"
            : "substitution",
      });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      out.push({ target: target[i - 1].surface, spoken: null, status: "missing" });
      i--;
    } else if (j > 0) {
      out.push({ target: null, spoken: spoken[j - 1].surface, status: "extra" });
      j--;
    }
  }

  return out.reverse();
}
