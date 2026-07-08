// Intonation scoring.
//
// Driven by a real pitch-contour similarity (0..1) computed in the browser from
// the user's recording vs. the reference audio (see lib/speech/pitch.ts).
// Returns null when intonation could not be measured — e.g. the lesson has no
// reference audio (TTS-only), or a recording had too little voiced speech. A
// null score is honestly excluded from the total rather than faked.

export interface IntonationInput {
  /** Pitch-contour similarity in 0..1, or null/undefined if not measurable. */
  similarity?: number | null;
}

export function scoreIntonation({
  similarity,
}: IntonationInput = {}): number | null {
  if (similarity == null || Number.isNaN(similarity)) return null;
  const s = Math.max(0, Math.min(1, similarity));
  // Lenient curve (exponent < 1 lifts the mid-range): being roughly on the
  // right melody earns a comfortable score. Intonation is the least reliable
  // signal, so we don't punish imperfect-but-reasonable attempts.
  return Math.round(Math.pow(s, 0.7) * 100);
}
