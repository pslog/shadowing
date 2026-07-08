// Weighted total: Pronunciation 50% + Speed 30% + Intonation 20%. (prompt §5)

export function scoreTotal(
  pronunciationScore: number,
  speedScore: number,
  intonationScore: number,
): number {
  return Math.round(
    pronunciationScore * 0.5 + speedScore * 0.3 + intonationScore * 0.2,
  );
}
