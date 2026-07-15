// Weighted total for the Web Speech based shadowing scorer.
//
// Pronunciation carries the scoring because it is the strongest signal for
// "did the learner say the right Japanese". Speed and intonation are supporting
// shadowing signals and should not pull a weak/partial utterance into Pass.
//
// Dynamic weighting: a dimension that could not be measured (intonation is
//    null when there's no reference audio) is dropped and the remaining weights
//    are renormalized, instead of feeding a fabricated number into the total.
const GATE_MARGIN = 12;

export function scoreTotal(
  pronunciationScore: number,
  speedScore: number,
  intonationScore: number | null,
): number {
  const dims: Array<{ value: number; weight: number }> = [
    { value: pronunciationScore, weight: 0.6 },
    { value: speedScore, weight: 0.25 },
  ];
  if (intonationScore != null) {
    dims.push({ value: intonationScore, weight: 0.15 });
  }

  const weightSum = dims.reduce((s, d) => s + d.weight, 0);
  const weighted =
    dims.reduce((s, d) => s + d.value * d.weight, 0) / weightSum;

  const ceiling = pronunciationScore + GATE_MARGIN;
  return Math.round(Math.min(weighted, ceiling));
}
