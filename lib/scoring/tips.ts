// Concrete, actionable coaching derived from the mora alignment and timing.
// Structured (not prose) so the UI can localize and highlight it.

import type { ScoreAlignmentToken, ScoreTip } from "@/lib/types";
import { mismatchCost } from "./pronunciation";

const MAX_TIPS = 3;

function context(alignment: ScoreAlignmentToken[], index: number) {
  const side = (from: number, step: number) => {
    const out: string[] = [];
    for (let i = from; i >= 0 && i < alignment.length && out.length < 2; i += step) {
      const unit = alignment[i].target;
      if (unit) out.push(unit);
    }
    return step < 0 ? out.reverse().join("") : out.join("");
  };
  return { before: side(index - 1, -1), after: side(index + 1, 1) };
}

export function buildTips(
  alignment: ScoreAlignmentToken[],
  speedDeltaPercent: number | null,
): ScoreTip[] {
  const mora: Array<ScoreTip & { cost: number; order: number }> = [];
  alignment.forEach((token, i) => {
    const cost = mismatchCost(token);
    if (cost === 0 || cost < 0.5) return; // spelling-only differences: no tip
    const kind =
      token.status === "missing" ? "missing" : token.status === "extra" ? "extra" : "substitution";
    mora.push({
      kind,
      target: token.target ?? undefined,
      spoken: token.spoken ?? undefined,
      ...context(alignment, i),
      cost,
      order: i,
    });
  });
  // Real wrong sounds first, then special-mora slips; keep sentence order.
  mora.sort((a, b) => b.cost - a.cost || a.order - b.order);
  const tips: ScoreTip[] = mora.slice(0, MAX_TIPS).map(({ cost: _c, order: _o, ...tip }) => tip);

  if (speedDeltaPercent != null && Math.abs(speedDeltaPercent) >= 15 && tips.length < MAX_TIPS) {
    tips.push({ kind: speedDeltaPercent > 0 ? "too_fast" : "too_slow", percent: Math.abs(speedDeltaPercent) });
  }
  return tips;
}
