import { NextResponse } from "next/server";
import { toReadingTokens, type ReadingToken } from "@/lib/scoring/kana";
import { scoreLessonRun } from "@/lib/scoring/lesson";
import { LATIN_WILDCARD, normalizeJa } from "@/lib/scoring/pronunciation";

export const runtime = "nodejs";

const MAX_SENTENCES = 80;
const MAX_TEXT = 8000;

// POST /api/score/lesson
// Body: { sentences: string[], transcript: string }
// Scores one continuous full-lesson shadowing run (see lib/scoring/lesson.ts).
export async function POST(request: Request) {
  let body: { sentences?: unknown; transcript?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { sentences, transcript } = body;
  if (
    !Array.isArray(sentences) || sentences.length === 0 || sentences.length > MAX_SENTENCES ||
    sentences.some((s) => typeof s !== "string" || !s.trim()) ||
    sentences.join("").length > MAX_TEXT ||
    typeof transcript !== "string" || transcript.length > MAX_TEXT
  ) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  if (!transcript.trim()) return NextResponse.json({ error: "no_transcript" }, { status: 422 });

  const join = (tokens: ReadingToken[] | null) =>
    tokens?.map((t) => t.reading).join("").replace(/+/g, LATIN_WILDCARD) ?? null;
  const targetReadings = await Promise.all((sentences as string[]).map(async (s) => join(await toReadingTokens(s))));
  const spokenReading = join(await toReadingTokens(transcript));
  const readable = (r: string | null): r is string => r != null && /^[ァ-ヺー]*$/u.test(normalizeJa(r));
  if (!targetReadings.every(readable) || spokenReading == null) {
    return NextResponse.json({ error: "reading_unavailable" }, { status: 422 });
  }
  // A minutes-long transcript will contain the odd token without a kana
  // reading; drop it (it simply fails to match) instead of refusing the run.
  const spoken = normalizeJa(spokenReading).replace(/[^ァ-ヺー]/gu, "");
  return NextResponse.json(scoreLessonRun(targetReadings, spoken));
}
