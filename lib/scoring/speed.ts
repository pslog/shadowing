// Speed scoring based on the ratio of the user's utterance duration to the
// reference duration. See prompt.txt §5.

export interface SpeedInput {
  originalDurationSeconds?: number | null;
  userDurationSeconds?: number | null;
  seed?: number;
}

/** Returns a 0..100 speed score. */
export function scoreSpeed({
  originalDurationSeconds,
  userDurationSeconds,
  seed,
}: SpeedInput): number {
  if (
    !originalDurationSeconds ||
    originalDurationSeconds <= 0 ||
    !userDurationSeconds ||
    userDurationSeconds <= 0
  ) {
    // No reference timing available -> realistic mock.
    return Math.round(70 + (seed ?? 0.5) * 25);
  }

  const ratio = userDurationSeconds / originalDurationSeconds;

  if (ratio >= 0.85 && ratio <= 1.15) {
    // Great: map closeness-to-1 into 90..100.
    const closeness = 1 - Math.abs(1 - ratio) / 0.15; // 1 at ratio 1, 0 at edges
    return Math.round(90 + closeness * 10);
  }
  if (ratio >= 0.7 && ratio <= 1.3) {
    // Acceptable band 70..89.
    const edge = ratio < 0.85 ? (ratio - 0.7) / 0.15 : (1.3 - ratio) / 0.15;
    return Math.round(70 + edge * 19);
  }
  // Off: 50..69, degrading as it gets further out. Speed is a supporting
  // signal; a correct sentence should be coached as slow/fast, not crushed.
  const overflow = ratio < 0.7 ? 0.7 - ratio : ratio - 1.3;
  const score = 69 - Math.min(overflow / 0.5, 1) * 19;
  return Math.max(50, Math.round(score));
}

/** How much faster/slower than reference, as a signed % (+ = too fast). */
export function speedDelta(
  originalDurationSeconds?: number | null,
  userDurationSeconds?: number | null,
): number | null {
  if (!originalDurationSeconds || !userDurationSeconds) return null;
  const ratio = userDurationSeconds / originalDurationSeconds;
  return Math.round((1 / ratio - 1) * 100) * -1; // positive => spoke faster
}
