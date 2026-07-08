"use client";

import { scoreAttempt, type ScoreRequest } from "@/lib/scoring";
import type { ScoreBreakdown } from "@/lib/types";

/**
 * Call the /api/score endpoint. Falls back to running the same scoring engine
 * locally if the request fails (offline / dev), so the flow never breaks.
 */
export async function scoreSentence(req: ScoreRequest): Promise<ScoreBreakdown> {
  try {
    const res = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`score ${res.status}`);
    return (await res.json()) as ScoreBreakdown;
  } catch {
    return scoreAttempt(req);
  }
}

/**
 * Rough spoken-duration estimate for a Japanese sentence when no reference
 * audio timing exists. ~0.16s per character with a floor, so the speed score
 * has a sensible baseline to compare against.
 */
export function estimateDurationSeconds(text: string): number {
  const chars = text.replace(/[\s　。、！？!?.,]/g, "").length;
  return Math.max(1.2, Math.round(chars * 0.16 * 10) / 10);
}
