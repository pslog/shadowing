import { NextResponse } from "next/server";
import { scoreAttempt, type ScoreRequest } from "@/lib/scoring";
import { toReading } from "@/lib/scoring/kana";

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
  const [targetReading, spokenReading] = await Promise.all([
    toReading(body.targetText),
    body.spokenText ? toReading(body.spokenText) : Promise.resolve(""),
  ]);

  const result = scoreAttempt({ ...body, targetReading, spokenReading });
  return NextResponse.json(result);
}
