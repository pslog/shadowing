// Intonation scoring.
//
// A real implementation would compare pitch/energy contours between the
// reference audio and the user's recording. For now we return a realistic
// mock (65..95). Kept as its own module so the pitch-contour version drops in
// without touching callers.

export interface IntonationInput {
  seed?: number;
}

export function scoreIntonation({ seed }: IntonationInput = {}): number {
  return Math.round(65 + (seed ?? 0.5) * 30);
}
