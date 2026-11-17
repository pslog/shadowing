// Star rating for one shadowing attempt. Pure, derived from stored fields, so
// old attempts get stars too and nothing new has to be persisted.
//
//   ★      passed — the sentence was read right (pass gate)
//   ★★     + rhythm: timing close to the reference
//   ★★★    + melody: pitch contour close to the reference
//
// When a dimension could not be measured (TTS-only lesson, no reference
// timing/pitch) the star falls back to a stricter content criterion instead of
// being given away or made impossible.

export const RHYTHM_STAR_SPEED = 90;
export const MELODY_STAR_INTONATION = 70;

export interface StarInput {
  passed: boolean;
  pronunciation: number;
  speed: number | null;
  intonation: number | null;
  total: number;
}

export interface StarBreakdown {
  stars: 0 | 1 | 2 | 3;
  rhythm: boolean;
  melody: boolean;
}

export function starBreakdown(s: StarInput): StarBreakdown {
  if (!s.passed) return { stars: 0, rhythm: false, melody: false };
  const rhythm = s.speed != null ? s.speed >= RHYTHM_STAR_SPEED : s.pronunciation >= 100;
  const melody = s.intonation != null ? s.intonation >= MELODY_STAR_INTONATION : s.total >= 95;
  return { stars: (1 + Number(rhythm) + Number(melody)) as 1 | 2 | 3, rhythm, melody };
}

export function starsFor(s: StarInput): 0 | 1 | 2 | 3 {
  return starBreakdown(s).stars;
}

/** Stars for a persisted attempt row. */
export function starsForAttempt(a: {
  is_passed: boolean;
  pronunciation_score: number;
  speed_score: number | null;
  intonation_score: number | null;
  total_score: number;
}): 0 | 1 | 2 | 3 {
  return starsFor({
    passed: a.is_passed,
    pronunciation: a.pronunciation_score,
    speed: a.speed_score,
    intonation: a.intonation_score,
    total: a.total_score,
  });
}
