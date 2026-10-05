"use client";

import type { ScoreRequest } from "@/lib/scoring";
import type { ScoreBreakdown } from "@/lib/types";

/** Score on the server; failures remain explicit and never use a different algorithm. */
export async function scoreSentence(req: ScoreRequest): Promise<ScoreBreakdown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error ?? "score_unavailable");
    if (result.scoringVersion !== "transcript-v2" || !Number.isFinite(result.total) || typeof result.passed !== "boolean") throw new Error("invalid_score_response");
    return result as ScoreBreakdown;
  } catch (error) {
    // Never silently change algorithms or award XP on transport failures.
    throw error instanceof Error ? error : new Error("score_unavailable");
  } finally {
    window.clearTimeout(timeout);
  }
}
