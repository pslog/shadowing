// Weighted total: Pronunciation 50% + Speed 30% + Intonation 20%. (prompt §5)
//
// Two honesty rules on top of the weighted average:
//
// 1. Dynamic weighting — a dimension that could not be measured (intonation is
//    null when there's no reference audio) is dropped and the remaining weights
//    are renormalized, instead of feeding a fabricated number into the total.
//
// 2. Correctness gate — pronunciation is the signal for "did you say the right
//    words". Speed & intonation must not lift a wrong utterance to a pass on
//    their own, so pronunciation also caps the total: it can exceed the
//    pronunciation score by at most GATE_MARGIN. Say the wrong text and you
//    fail no matter how well-paced or well-intoned it was.
const GATE_MARGIN = 12;

export function scoreTotal(
  pronunciationScore: number,
  speedScore: number,
  intonationScore: number | null,
): number {
  const dims: Array<{ value: number; weight: number }> = [
    { value: pronunciationScore, weight: 0.5 },
    { value: speedScore, weight: 0.3 },
  ];
  if (intonationScore != null) {
    dims.push({ value: intonationScore, weight: 0.2 });
  }

  const weightSum = dims.reduce((s, d) => s + d.weight, 0);
  const weighted =
    dims.reduce((s, d) => s + d.value * d.weight, 0) / weightSum;

  const ceiling = pronunciationScore + GATE_MARGIN;
  return Math.round(Math.min(weighted, ceiling));
}
