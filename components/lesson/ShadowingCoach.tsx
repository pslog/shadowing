"use client";

// Post-attempt coaching: star tiers, concrete mora/timing tips, a pitch overlay
// of the learner vs the reference, and an A/B "model → me" playback.

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { Locale } from "@/lib/i18n";
import { starBreakdown } from "@/lib/scoring/stars";
import type { ScoreBreakdown, ScoreTip } from "@/lib/types";

const COPY = {
  vi: {
    starRead: "Đọc đúng",
    starRhythm: "Nhịp",
    starMelody: "Ngữ điệu",
    nextRhythm: "Lấy ★ Nhịp: nói khớp tốc độ audio mẫu (lệch dưới 10%).",
    nextRhythmNoRef: "Lấy ★ Nhịp: đọc khớp hoàn toàn câu mẫu.",
    nextMelody: "Lấy ★ Ngữ điệu: lên xuống giọng giống đường mẫu bên dưới.",
    nextMelodyNoRef: "Lấy ★ Ngữ điệu: đạt tổng điểm từ 95.",
    allStars: "Hoàn hảo ★★★ — thử ẩn chữ và shadow lại theo trí nhớ!",
    passFirst: "Pass câu này để mở khóa sao.",
    tipsTitle: "Chỗ cần sửa",
    missing: (t: string) => `Thiếu 「${t}」`,
    extra: (t: string) => `Thừa 「${t}」`,
    substitution: (t: string, s: string) => `「${t}」 nghe thành 「${s}」`,
    tooFast: (p: number) => `Nhanh hơn mẫu ${p}% — chậm lại, bám theo audio.`,
    tooSlow: (p: number) => `Chậm hơn mẫu ${p}% — bắt kịp audio, đừng ngắt giữa câu.`,
    hintッ: "Âm ngắt: dừng nửa nhịp trước phụ âm sau.",
    hintー: "Trường âm: kéo dài nguyên âm thêm một nhịp.",
    hintン: "Âm ン: giữ đủ một nhịp, đừng nuốt.",
    pitchTitle: "Ngữ điệu: bạn và mẫu",
    pitchModel: "Mẫu",
    pitchYou: "Bạn",
    pitchHint: "Đường càng trùng nhau, ngữ điệu càng giống. Chú ý chỗ lên/xuống giọng.",
    ab: "Nghe mẫu → giọng mình",
    abPlaying: "Đang phát…",
  },
  ja: {
    starRead: "正確さ",
    starRhythm: "リズム",
    starMelody: "イントネーション",
    nextRhythm: "★リズム：お手本の速さに合わせましょう（差10%以内）。",
    nextRhythmNoRef: "★リズム：お手本と完全に一致させましょう。",
    nextMelody: "★イントネーション：下のお手本の高低に合わせましょう。",
    nextMelodyNoRef: "★イントネーション：合計95点以上を目指しましょう。",
    allStars: "★★★達成！文字を隠して記憶でシャドーイングしてみましょう。",
    passFirst: "合格すると星が付きます。",
    tipsTitle: "直すポイント",
    missing: (t: string) => `「${t}」が抜けています`,
    extra: (t: string) => `「${t}」が余分です`,
    substitution: (t: string, s: string) => `「${t}」が「${s}」に聞こえます`,
    tooFast: (p: number) => `お手本より${p}%速いです。音声に合わせましょう。`,
    tooSlow: (p: number) => `お手本より${p}%遅いです。途中で止まらずに。`,
    hintッ: "促音：次の子音の前で半拍止めます。",
    hintー: "長音：母音をもう一拍伸ばします。",
    hintン: "撥音：一拍しっかり保ちます。",
    pitchTitle: "イントネーション比較",
    pitchModel: "お手本",
    pitchYou: "あなた",
    pitchHint: "線が重なるほどお手本に近いです。上がり下がりに注目。",
    ab: "お手本 → 自分の声",
    abPlaying: "再生中…",
  },
} as const;

type Copy = (typeof COPY)[Locale];

export function StarRow({ stars, size = 16 }: { stars: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${stars}/3`}>
      {[1, 2, 3].map((n) => (
        <Icon
          key={n}
          name="star"
          size={size}
          filled={n <= stars}
          className={n <= stars ? "text-[var(--c-amber)]" : "text-[color-mix(in_srgb,var(--muted)_45%,transparent)]"}
        />
      ))}
    </span>
  );
}

function tipText(tip: ScoreTip, c: Copy): { main: string; hint?: string } {
  const unit = tip.target ?? tip.spoken ?? "";
  const hint =
    unit === "ッ" ? c.hintッ : unit === "ー" ? c.hintー : unit === "ン" ? c.hintン : undefined;
  switch (tip.kind) {
    case "missing":
      return { main: c.missing(unit), hint };
    case "extra":
      return { main: c.extra(unit) };
    case "substitution":
      return { main: c.substitution(tip.target ?? "", tip.spoken ?? ""), hint };
    case "too_fast":
      return { main: c.tooFast(tip.percent ?? 0) };
    case "too_slow":
      return { main: c.tooSlow(tip.percent ?? 0) };
  }
}

function PitchCompare({
  user,
  reference,
  c,
}: {
  user: Array<number | null>;
  reference: Array<number | null>;
  c: Copy;
}) {
  const W = 320;
  const H = 96;
  const PAD = 8;
  const all = [...user, ...reference].filter((v): v is number => v != null);
  const lim = Math.max(3, ...all.map((v) => Math.abs(v)));
  const path = (pts: Array<number | null>) => {
    let d = "";
    let pen = false;
    pts.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      const x = PAD + (i / Math.max(1, pts.length - 1)) * (W - 2 * PAD);
      const y = H / 2 - (v / lim) * (H / 2 - PAD);
      d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-extrabold">{c.pitchTitle}</span>
        <span className="flex items-center gap-3 text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 rounded bg-[var(--muted)]" />
            {c.pitchModel}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1 w-4 rounded bg-primary" />
            {c.pitchYou}
          </span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-24 w-full" preserveAspectRatio="none" role="img" aria-label={c.pitchTitle}>
        <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="var(--border)" strokeDasharray="3 4" />
        <path d={path(reference)} fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" vectorEffect="non-scaling-stroke" />
        <path d={path(user)} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="mt-1 text-[11px] text-muted">{c.pitchHint}</p>
    </div>
  );
}

export function ShadowingCoach({
  score,
  locale,
  pitch,
  onPlayAB,
}: {
  score: ScoreBreakdown;
  locale: Locale;
  pitch?: { user: Array<number | null>; reference: Array<number | null> } | null;
  onPlayAB?: () => Promise<void>;
}) {
  const c = COPY[locale] ?? COPY.vi;
  const [abBusy, setAbBusy] = useState(false);
  const star = starBreakdown(score);
  const tips = score.tips ?? [];

  const next: string[] = [];
  if (!score.passed) next.push(c.passFirst);
  else {
    if (!star.rhythm) next.push(score.speed != null ? c.nextRhythm : c.nextRhythmNoRef);
    if (!star.melody) next.push(score.intonation != null ? c.nextMelody : c.nextMelodyNoRef);
    if (star.stars === 3) next.push(c.allStars);
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold">
          <StarRow stars={star.stars} size={20} />
          {[
            [score.passed, c.starRead],
            [star.rhythm, c.starRhythm],
            [star.melody, c.starMelody],
          ].map(([ok, label]) => (
            <span key={String(label)} className={ok ? "text-[var(--success)]" : "text-muted"}>
              <Icon name={ok ? "check" : "star"} size={12} strokeWidth={2.5} className="mr-0.5 inline" />
              {label}
            </span>
          ))}
        </div>
        {next.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-muted">
            {next.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>

      {tips.length > 0 && (
        <div className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] p-3">
          <p className="text-xs font-extrabold text-[var(--warning)]">{c.tipsTitle}</p>
          <ul className="mt-1.5 space-y-1.5">
            {tips.map((tip, i) => {
              const { main, hint } = tipText(tip, c);
              const unit = tip.target ?? tip.spoken;
              return (
                <li key={i} className="text-sm">
                  <span className="font-semibold">{main}</span>
                  {unit && (tip.before || tip.after) && (
                    <span lang="ja" className="ml-2 rounded-md bg-card px-1.5 py-0.5 text-xs">
                      …{tip.before}
                      <mark className="rounded bg-[var(--warning)] px-0.5 text-white">{tip.kind === "extra" ? tip.spoken : tip.target}</mark>
                      {tip.after}…
                    </span>
                  )}
                  {hint && <span className="block text-xs text-muted">{hint}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pitch && pitch.user.length > 2 && pitch.reference.length > 2 && (
        <PitchCompare user={pitch.user} reference={pitch.reference} c={c} />
      )}

      {onPlayAB && (
        <button
          type="button"
          disabled={abBusy}
          onClick={async () => {
            setAbBusy(true);
            try {
              await onPlayAB();
            } finally {
              setAbBusy(false);
            }
          }}
          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold text-primary transition-colors hover:border-primary/40 disabled:opacity-60"
        >
          <Icon name="volume" size={16} />
          {abBusy ? c.abPlaying : c.ab}
        </button>
      )}
    </div>
  );
}
