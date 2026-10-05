// Existing heuristic weights, not calibrated against human-rated recordings.
// The legacy pronunciation field measures transcript-reading match only.
// Missing optional dimensions are omitted, never fabricated.
const GATE_MARGIN = 12;

export function scoreTotal(
  pronunciationScore: number,
  coverageScore: number,
  speedScore: number | null,
  intonationScore: number | null,
): number {
  const dims: Array<{ value: number; weight: number }> = [
    { value: pronunciationScore, weight: 0.65 },
    { value: coverageScore, weight: 0.2 },

  ];
  if (speedScore != null) dims.push({ value: speedScore, weight: 0.1 });
  if (intonationScore != null) {
    dims.push({ value: intonationScore, weight: 0.05 });
  }

  const weightSum = dims.reduce((s, d) => s + d.weight, 0);
  const weighted =
    dims.reduce((s, d) => s + d.value * d.weight, 0) / weightSum;

  const ceiling = pronunciationScore + GATE_MARGIN;
  return Math.round(Math.min(weighted, ceiling));
}
