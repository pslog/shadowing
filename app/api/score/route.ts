import { NextResponse } from "next/server";
import { scoreAttempt, type ScoreRequest } from "@/lib/scoring";

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

  const result = scoreAttempt(body);
  return NextResponse.json(result);
}
