// Pitch-contour analysis for intonation scoring.
//
// The core functions are pure (Float32Array + sampleRate in, numbers out) so
// they can be unit-tested in Node without Web Audio. `extractContourFromUrl`
// is the thin browser wrapper that decodes an audio URL into samples.
//
// Intonation = the *shape* of the pitch over time, independent of the speaker's
// absolute voice pitch. So we compare mean-normalized semitone contours: a man
// and a woman saying the same sentence with the same melody score high.

const MIN_HZ = 70; // below ~male floor
const MAX_HZ = 400; // above ~female ceiling for speech

/**
 * Fundamental-frequency estimate for one frame via normalized autocorrelation.
 * Returns 0 when the frame is unvoiced / too quiet to be reliable.
 */
export function detectPitchHz(
  frame: Float32Array,
  sampleRate: number,
): number {
  const n = frame.length;

  // Energy gate: skip silence.
  let rms = 0;
  for (let i = 0; i < n; i++) rms += frame[i] * frame[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.01) return 0;

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ));
  const maxLag = Math.min(n - 1, Math.floor(sampleRate / MIN_HZ));
  if (maxLag <= minLag) return 0;

  // Normalized cross-correlation per lag (proper per-lag normalization keeps
  // the peak near 1 at the true period and avoids inflating long lags).
  const nc = new Array<number>(maxLag + 1).fill(0);
  let bestLag = -1;
  let bestNc = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i < n - lag; i++) {
      corr += frame[i] * frame[i + lag];
      e1 += frame[i] * frame[i];
      e2 += frame[i + lag] * frame[i + lag];
    }
    const den = Math.sqrt(e1 * e2);
    const v = den > 0 ? corr / den : 0;
    nc[lag] = v;
    if (v > bestNc) {
      bestNc = v;
      bestLag = lag;
    }
  }
  if (bestLag < 0 || bestNc < 0.5) return 0; // unvoiced / no clear period

  // Octave correction: if a sub-multiple lag (higher fundamental) is nearly as
  // strong, prefer it — cures the common "octave-too-low" error.
  for (const div of [4, 3, 2]) {
    const cand = Math.round(bestLag / div);
    if (cand >= minLag && nc[cand] >= 0.85 * bestNc) {
      bestLag = cand;
      break;
    }
  }

  return sampleRate / bestLag;
}

/**
 * Frame-by-frame pitch track. Returns Hz per hop (0 = unvoiced).
 */
export function pitchContour(
  samples: Float32Array,
  sampleRate: number,
  frameMs = 40,
  hopMs = 20,
): number[] {
  const frameLen = Math.floor((frameMs / 1000) * sampleRate);
  const hopLen = Math.floor((hopMs / 1000) * sampleRate);
  if (samples.length < frameLen) return [];
  const out: number[] = [];
  for (let start = 0; start + frameLen <= samples.length; start += hopLen) {
    out.push(detectPitchHz(samples.subarray(start, start + frameLen), sampleRate));
  }
  return out;
}

/** Voiced Hz values -> mean-normalized semitones (drops unvoiced frames). */
function toNormalizedSemitones(contour: number[]): number[] {
  const voiced = contour.filter((hz) => hz > 0);
  if (voiced.length < 3) return [];
  const semis = voiced.map((hz) => 12 * Math.log2(hz));
  const mean = semis.reduce((a, b) => a + b, 0) / semis.length;
  return semis.map((s) => s - mean);
}

// Reference melodies flatter than this (semitone std-dev) carry too little
// intonation to grade against — treated as "not measurable".
const MIN_REF_STD_SEMITONES = 0.6;
// Weight of the "did you move enough" factor vs "did you move in the right
// places". Direction (correlation) leads; range is only a gentle modifier —
// deliberately lenient, since we don't have validated ground truth for exactly
// how much natural pitch variation a "good" learner shows. Being roughly right
// in direction should already score well.
const RANGE_FLOOR = 0.65;
// Sakoe-Chiba band: cap how far DTW may warp (fraction of length). Keeps timing
// roughly proportional so DTW can't over-align genuinely different contours.
const DTW_BAND_FRAC = 0.2;

function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const varc = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return Math.sqrt(varc);
}

/**
 * DTW-align two series (within a Sakoe-Chiba band) and return the value pairs
 * along the optimal warping path. Absorbs tempo / pause differences so the same
 * melody spoken faster or with a different breath break still lines up.
 */
function dtwAlignedPairs(
  a: number[],
  b: number[],
): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  const INF = Infinity;
  const cost: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(INF),
  );
  cost[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      // Length-normalized band constraint.
      if (Math.abs((i - 1) / n - (j - 1) / m) > DTW_BAND_FRAC) continue;
      const d = Math.abs(a[i - 1] - b[j - 1]);
      cost[i][j] =
        d + Math.min(cost[i - 1][j], cost[i][j - 1], cost[i - 1][j - 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    pairs.push([a[i - 1], b[j - 1]]);
    const diag = cost[i - 1][j - 1];
    const up = cost[i - 1][j];
    const left = cost[i][j - 1];
    if (diag <= up && diag <= left) {
      i--;
      j--;
    } else if (up <= left) {
      i--;
    } else {
      j--;
    }
  }
  return pairs;
}

export interface ContourMetrics {
  /** Final similarity 0..1 (feeds the intonation score). */
  score: number;
  /** Directional match: do the ups/downs land in the same places (0..1). */
  corr: number;
  /** How much of the reference's pitch movement was reproduced (0..1). */
  rangeRatio: number;
  /** Learner pitch variability, in semitones. */
  userStd: number;
  /** Reference pitch variability, in semitones (the per-sentence yardstick). */
  refStd: number;
}

/**
 * Compare a learner contour (`user`) against the reference native contour
 * (`ref`) and return a self-calibrated breakdown, or null when the reference
 * carries too little intonation to judge against.
 *
 * Both are mean-normalized semitones (absolute voice pitch ignored) and
 * DTW-aligned (tempo/pause ignored). The reference is the yardstick, so there
 * are no hand-tuned magic thresholds:
 *   - corr       — are the rises/falls in the right places (Pearson, ≥0),
 *   - rangeRatio — did you use as much pitch movement as the native did.
 * A monotone read (common beginner error) drops rangeRatio → low score; the
 * reference vs. itself yields corr=1, rangeRatio=1 → 1.0 (sanity ceiling).
 */
export function contourMetrics(
  user: number[],
  ref: number[],
): ContourMetrics | null {
  const su = toNormalizedSemitones(user);
  const sr = toNormalizedSemitones(ref);
  if (su.length < 3 || sr.length < 3) return null;

  const refStd = stdDev(sr);
  if (refStd < MIN_REF_STD_SEMITONES) return null; // reference ~monotone
  const userStd = stdDev(su);

  const pairs = dtwAlignedPairs(su, sr);
  const len = pairs.length;
  if (len < 3) return null;

  let sumA = 0;
  let sumB = 0;
  for (const [x, y] of pairs) {
    sumA += x;
    sumB += y;
  }
  const ma = sumA / len;
  const mb = sumB / len;
  let num = 0;
  let da = 0;
  let db = 0;
  for (const [x, y] of pairs) {
    const xa = x - ma;
    const xb = y - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  // da === 0 means the learner was flat (no melody): corr = 0, not "unmeasured".
  const corr = da === 0 || db === 0 ? 0 : Math.max(0, num / Math.sqrt(da * db));
  const rangeRatio = Math.min(1, userStd / refStd);

  // Direction leads; range modulates between RANGE_FLOOR and 1.
  const score = corr * (RANGE_FLOOR + (1 - RANGE_FLOOR) * rangeRatio);
  return { score, corr, rangeRatio, userStd, refStd };
}

/** Similarity 0..1 of a learner contour vs. the reference, or null. */
export function contourSimilarity(
  user: number[],
  ref: number[],
): number | null {
  return contourMetrics(user, ref)?.score ?? null;
}

/** Decode an audio URL to mono samples and extract its pitch contour (browser). */
export async function extractContourFromUrl(
  url: string,
  range?: { start: number; end: number },
): Promise<number[]> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return [];
  const ctx = new AudioCtx();
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const sr = audio.sampleRate;
    const ch = audio.getChannelData(0);
    let samples: Float32Array = ch;
    if (range) {
      const from = Math.max(0, Math.floor(range.start * sr));
      const to = Math.min(ch.length, Math.floor(range.end * sr));
      if (to > from) samples = ch.subarray(from, to);
    }
    return pitchContour(samples, sr);
  } catch {
    return [];
  } finally {
    void ctx.close();
  }
}
