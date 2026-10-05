import { pitchContour } from "./pitch";

/** Basic signal checks, not speech/noise classification or a pronunciation model. */
export function analyzeSignal(samples: Float32Array, sampleRate: number) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || samples.length === 0) return null;
  const frame = Math.max(1, Math.floor(sampleRate * 0.02));
  let active = 0, clipped = 0, first = -1, last = 0;
  for (let from = 0; from < samples.length; from += frame) {
    const end = Math.min(samples.length, from + frame);
    let energy = 0;
    for (let i = from; i < end; i++) {
      if (!Number.isFinite(samples[i])) return null;
      energy += samples[i] ** 2;
      if (Math.abs(samples[i]) >= 0.99) clipped++;
    }
    // Conservative recording-quality heuristic; requires real-audio calibration.
    if (Math.sqrt(energy / (end - from)) >= 0.01) {
      active += end - from;
      if (first < 0) first = from;
      last = end;
    }
  }
  return {
    duration: samples.length / sampleRate,
    activeSeconds: active / sampleRate,
    clippedFraction: clipped / samples.length,
    // Remove leading/trailing quiet time only; keep internal pauses.
    speechSpanSeconds: first < 0 ? 0 : (last - first) / sampleRate,
  };
}

export async function analyzeRecording(url: string | null, range?: { start: number; end: number }) {
  if (!url) return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const audio = await ctx.decodeAudioData(await response.arrayBuffer());
    let samples = audio.getChannelData(0);
    if (range) {
      if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.start < 0 || range.end <= range.start || range.end > audio.duration + 0.05) return null;
      samples = samples.subarray(Math.floor(range.start * audio.sampleRate), Math.floor(range.end * audio.sampleRate));
    }
    const signal = analyzeSignal(samples, audio.sampleRate);
    if (!signal || signal.duration > 120) return null;
    // Lower sampling rate bounds CPU; this is only a basic periodicity check.
    const stride = Math.max(1, Math.floor(audio.sampleRate / 16000));
    const reduced = Float32Array.from({ length: Math.ceil(samples.length / stride) }, (_, i) => samples[i * stride]);
    const contour = pitchContour(reduced, audio.sampleRate / stride);
    return { ...signal, voicedSeconds: contour.filter((hz) => hz > 0).length * 0.02 };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
    await ctx.close();
  }
}
