import { NextResponse } from "next/server";
import { scoreAttempt, type ScoreRequest } from "@/lib/scoring";
import { toReadingTokens, type ReadingToken } from "@/lib/scoring/kana";
import type { ScoreAlignmentToken } from "@/lib/types";

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

  if (!body?.targetText || typeof body.targetText !== "string") {
    return NextResponse.json(
      { error: "targetText is required" },
      { status: 400 },
    );
  }

  // Convert both sides to katakana readings so pronunciation is scored
  // phonetically (kanji vs kana from STT no longer counts as an error). If the
  // tokenizer is unavailable, toReading returns null and scoring falls back to
  // kana-folded character comparison.
  const [targetTokens, spokenTokens] = await Promise.all([
    toReadingTokens(body.targetText),
    body.spokenText ? toReadingTokens(body.spokenText) : Promise.resolve([]),
  ]);
  const targetReading = targetTokens?.map((tok) => tok.reading).join("") ?? null;
  const spokenReading = spokenTokens?.map((tok) => tok.reading).join("") ?? null;

  const result = scoreAttempt({ ...body, targetReading, spokenReading });
  return NextResponse.json({
    ...result,
    textAlignment:
      targetTokens && spokenTokens
        ? alignReadingTokens(targetTokens, spokenTokens)
        : undefined,
  });
}

function alignReadingTokens(
  target: ReadingToken[],
  spoken: ReadingToken[],
): ScoreAlignmentToken[] {
  const m = target.length;
  const n = spoken.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = target[i - 1].reading === spoken[j - 1].reading ? 0 : 1;
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
          (target[i - 1].reading === spoken[j - 1].reading ? 0 : 1)
    ) {
      out.push({
        target: target[i - 1].surface,
        spoken: spoken[j - 1].surface,
        status:
          target[i - 1].reading === spoken[j - 1].reading
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
