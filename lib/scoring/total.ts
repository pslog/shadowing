// Weighted total for the Web Speech based shadowing scorer.
//
// Pronunciation carries the scoring because it is the strongest signal for
// "did the learner say the right Japanese". Coverage is the second strongest
// signal because a complete utterance should be rewarded. Speed and intonation
// are supporting shadowing signals and should not pull a weak/partial utterance
// into Pass or drag down a perfect pronunciation too much.
//
// Dynamic weighting: a dimension that could not be measured (intonation is
//    null when there's no reference audio) is dropped and the remaining weights
//    are renormalized, instead of feeding a fabricated number into the total.
const GATE_MARGIN = 12;

export function scoreTotal(
  pronunciationScore: number,
  coverageScore: number,
  speedScore: number,
  intonationScore: number | null,
): number {
  const dims: Array<{ value: number; weight: number }> = [
    { value: pronunciationScore, weight: 0.65 },
    { value: coverageScore, weight: 0.2 },
    { value: speedScore, weight: 0.1 },
  ];
  if (intonationScore != null) {
    dims.push({ value: intonationScore, weight: 0.05 });
  }

  const weightSum = dims.reduce((s, d) => s + d.weight, 0);
  const weighted =
    dims.reduce((s, d) => s + d.value * d.weight, 0) / weightSum;

  const ceiling = pronunciationScore + GATE_MARGIN;
  return Math.round(Math.min(weighted, ceiling));
}
