"use client";

// Practice levels beyond sentence-by-sentence shadowing:
//   Level 2 — ChainRunner: hands-free "listen → repeat" through the lesson,
//             every sentence scored exactly like level 1.
//   Level 3 — FullLessonRun: the whole lesson plays once while the learner
//             shadows over it; one continuous recording, scored per sentence.

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { StarRow } from "@/components/lesson/ShadowingCoach";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n";
import { lessonRunTotal, type LessonRunScore } from "@/lib/scoring/lesson";
import { starsFor } from "@/lib/scoring/stars";
import { speakJa, cancelSpeech } from "@/lib/speech/tts";
import { activeShare, activityEnvelope } from "@/lib/speech/quality";
import { useRecorder, type RecordResult } from "@/lib/speech/useRecorder";
import type { LessonSentence, ScoreBreakdown } from "@/lib/types";

export type PracticeMode = "sentence" | "chain" | "full";

// Recommended progress before each level. Advice only — never a lock.
export const CHAIN_RECOMMENDED = 0.6;
export const FULL_RECOMMENDED = 0.8;

const COPY = {
  vi: {
    modeSentence: "Từng câu",
    modeChain: "Nhại liền mạch",
    modeFull: "Shadow cả bài",
    modeSentenceHint: "Nghe, ghi âm và chấm từng câu.",
    modeChainHint: "Tự phát câu → bạn nhắc lại → tự sang câu kế. Dùng loa thoải mái.",
    modeFullHint: "Phát cả bài, bạn nói đè theo audio. Cần tai nghe hoặc máy khử được tiếng loa.",
    advice: (pct: number) => `Nên pass ${pct}% số câu trước khi lên cấp này`,
    progress: (n: number, total: number) => `Đã pass ${n}/${total} câu`,
    chainStart: "Bắt đầu nhại liền mạch",
    chainStop: "Dừng",
    chainDone: "Xong câu này",
    phaseListen: "Nghe…",
    phaseSpeak: "Đến lượt bạn — nói ngay!",
    phaseScoring: "Đang chấm…",
    chainFinished: "Hoàn thành lượt nhại liền mạch",
    chainSummary: (passed: number, total: number) => `Pass ${passed}/${total} câu trong lượt này`,
    chainReviewHint: "Bấm vào ô điểm để xem chi tiết câu đó.",
    fromSentence: (n: number) => `Bắt đầu từ câu ${n}`,
    speed: "Tốc độ",
    hideText: "Ẩn chữ (shadow theo trí nhớ)",
    echoChecking: "Đang kiểm tra loa… giữ im lặng 3 giây",
    echoIntro: "Lần đầu, app phát thử một câu qua loa (bạn giữ im lặng) để xem micro có thu lẫn tiếng loa không.",
    echoOk: "Loa ổn — micro không thu lẫn tiếng mẫu. Có thể shadow bằng loa.",
    echoLeak: "Micro đang thu lẫn tiếng loa, nên máy sẽ chấm cả giọng mẫu. Hãy đeo tai nghe (hoặc giảm âm lượng) rồi kiểm tra lại — hoặc luyện cấp 2, cấp đó dùng loa thoải mái.",
    echoRetry: "Kiểm tra lại",
    toChain: "Luyện cấp 2",
    leakedRun: "Có vẻ micro đã thu lẫn tiếng loa (máy nghe được câu mà bạn không nói). Lượt này không tính kỷ lục — hãy đeo tai nghe rồi thử lại.",
    summaryTitle: "Tổng kết lượt nhại",
    summaryAvg: "Điểm TB",
    summaryStars: "Sao",
    summaryPassed: "Pass",
    fullStart: "Bắt đầu shadow cả bài",
    fullStop: "Dừng và chấm",
    fullCancel: "Huỷ",
    fullListening: "Đang shadow… nói theo ngay sau audio",
    fullScoring: "Đang chấm cả bài…",
    resultTitle: "Kết quả shadow cả bài",
    total: "Tổng",
    accuracy: "Chính xác",
    keptUp: "Theo kịp",
    best: (n: number) => `Kỷ lục: ${n}`,
    newBest: "Kỷ lục mới!",
    heatHint: "Bấm câu đỏ/vàng để luyện lại từng câu.",
    liveTranscript: "Máy đang nghe được",
    transcriptTitle: "Script nhận dạng được (toàn bài)",
    compareTitle: "So sánh từng câu",
    heard: "Nghe được",
    heardNothing: "(không nghe được)",
    legendGood: "Tốt",
    legendPartial: "Chưa chuẩn",
    legendMissed: "Bỏ lỡ",
    retry: "Shadow lại",
    noTranscript: "Không nhận được lời nói. Kiểm tra micro rồi thử lại.",
    scoreFailed: "Chưa chấm được lượt này. Thử lại sau.",
    loginNeeded: "Đăng nhập để luyện các cấp cao hơn.",
    sttMissing: "Trình duyệt không hỗ trợ nhận dạng giọng nói (dùng Chrome).",
  },
  ja: {
    modeSentence: "一文ずつ",
    modeChain: "連続リピート",
    modeFull: "全文シャドーイング",
    modeSentenceHint: "一文ずつ聞いて録音・採点します。",
    modeChainHint: "自動で再生 → リピート → 次の文へ。スピーカーでもOK。",
    modeFullHint: "全文に重ねて話します。イヤホン、またはエコー除去できる端末が必要。",
    advice: (pct: number) => `${pct}%の文に合格してからがおすすめ`,
    progress: (n: number, total: number) => `合格 ${n}/${total} 文`,
    chainStart: "連続リピート開始",
    chainStop: "停止",
    chainDone: "この文は完了",
    phaseListen: "聞いて…",
    phaseSpeak: "あなたの番です！",
    phaseScoring: "採点中…",
    chainFinished: "連続リピート完了",
    chainSummary: (passed: number, total: number) => `今回 ${passed}/${total} 文に合格`,
    chainReviewHint: "スコアを押すとその文の詳細を表示します。",
    fromSentence: (n: number) => `${n}文目から開始`,
    speed: "速度",
    hideText: "文字を隠す（記憶でシャドーイング）",
    echoChecking: "スピーカーを確認中… 3秒間お静かに",
    echoIntro: "最初に一文をスピーカーで再生し（話さないでください）、マイクがお手本の音を拾うか確認します。",
    echoOk: "問題ありません。スピーカーでシャドーイングできます。",
    echoLeak: "マイクがスピーカーの音を拾っているため、お手本の声まで採点されます。イヤホンを使う（または音量を下げる）か、スピーカーで使える連続リピートを練習してください。",
    echoRetry: "もう一度確認",
    toChain: "連続リピートへ",
    leakedRun: "マイクがスピーカーの音を拾ったようです（話していない文が認識されました）。今回はベストに記録しません。イヤホンで再挑戦してください。",
    summaryTitle: "連続リピートのまとめ",
    summaryAvg: "平均点",
    summaryStars: "星",
    summaryPassed: "合格",
    fullStart: "全文シャドーイング開始",
    fullStop: "終了して採点",
    fullCancel: "キャンセル",
    fullListening: "シャドーイング中… 音声のすぐ後を追って",
    fullScoring: "全文を採点中…",
    resultTitle: "全文シャドーイングの結果",
    total: "合計",
    accuracy: "正確さ",
    keptUp: "追従",
    best: (n: number) => `ベスト: ${n}`,
    newBest: "自己ベスト更新！",
    heatHint: "赤・黄の文を押すと一文ずつ練習できます。",
    liveTranscript: "認識中のテキスト",
    transcriptTitle: "認識されたスクリプト（全文）",
    compareTitle: "文ごとの比較",
    heard: "認識",
    heardNothing: "（認識なし）",
    legendGood: "良い",
    legendPartial: "要練習",
    legendMissed: "抜け",
    retry: "もう一度",
    noTranscript: "音声が認識されませんでした。マイクを確認してください。",
    scoreFailed: "採点できませんでした。後でもう一度。",
    loginNeeded: "ログインすると上級モードを練習できます。",
    sttMissing: "このブラウザは音声認識に対応していません（Chromeを使用）。",
  },
} as const;

type Copy = (typeof COPY)[Locale];
const copyFor = (locale: Locale): Copy => COPY[locale] ?? COPY.vi;

/* ------------------------------------------------------------------ */
/* Mode switcher                                                       */
/* ------------------------------------------------------------------ */

export function ModeSwitcher({
  mode,
  onChange,
  passedRatio,
  passedCount,
  total,
  locale,
  disabled,
}: {
  mode: PracticeMode;
  onChange: (mode: PracticeMode) => void;
  passedRatio: number;
  passedCount: number;
  total: number;
  locale: Locale;
  disabled?: boolean;
}) {
  const c = copyFor(locale);
  const modes: Array<{ id: PracticeMode; label: string; hint: string; unlock: number; level: number }> = [
    { id: "sentence", label: c.modeSentence, hint: c.modeSentenceHint, unlock: 0, level: 1 },
    { id: "chain", label: c.modeChain, hint: c.modeChainHint, unlock: CHAIN_RECOMMENDED, level: 2 },
    { id: "full", label: c.modeFull, hint: c.modeFullHint, unlock: FULL_RECOMMENDED, level: 3 },
  ];
  return (
    <div className="rounded-2xl border border-border bg-surface/80 p-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {modes.map((m) => {
          const early = passedRatio < m.unlock;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(m.id)}
              aria-pressed={active}
              className={cn(
                "focus-ring rounded-xl border px-3 py-2.5 text-left transition-all",
                active
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-border bg-card hover:border-primary/40",
                disabled && !active && "cursor-not-allowed opacity-60 hover:border-border",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-extrabold">
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full text-[10px]",
                    active ? "bg-white/25" : "bg-primary/10 text-primary",
                  )}
                >
                  {m.level}
                </span>
                {m.label}
              </span>
              <span className={cn("mt-1 block text-[11px] leading-4", active ? "text-white/85" : "text-muted")}>
                {m.hint}
              </span>
              {early && (
                <span
                  className={cn(
                    "mt-1 block text-[11px] font-bold leading-4",
                    active ? "text-white" : "text-[var(--warning)]",
                  )}
                >
                  💡 {c.advice(Math.round(m.unlock * 100))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-[11px] font-bold text-muted">{c.progress(passedCount, total)}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Level 2 — chained listen → repeat                                   */
/* ------------------------------------------------------------------ */

function RunOptions({
  rate,
  onRate,
  hideText,
  onHideText,
  c,
}: {
  rate: number;
  onRate: (v: number) => void;
  hideText: boolean;
  onHideText: (v: boolean) => void;
  c: Copy;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
      <span className="text-muted">{c.speed}</span>
      {[0.9, 1, 1.1].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onRate(v)}
          className={cn(
            "focus-ring rounded-lg border px-2.5 py-1 tabular-nums",
            rate === v ? "border-primary bg-primary text-white" : "border-border bg-card",
          )}
        >
          {v}x
        </button>
      ))}
      <label className="ml-2 flex cursor-pointer items-center gap-1.5">
        <input type="checkbox" checked={hideText} onChange={(e) => onHideText(e.target.checked)} />
        {c.hideText}
      </label>
    </div>
  );
}

function sentenceSeconds(s: LessonSentence): number {
  if (s.audio_start != null && s.audio_end != null && s.audio_end > s.audio_start) {
    return s.audio_end - s.audio_start;
  }
  // No timing: ~7 mora/s for natural Japanese, plus a little slack.
  return Math.max(1.2, s.ja_text.length * 0.16);
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export function ChainRunner({
  sentences,
  startIndex,
  locale,
  playSentence,
  scoreRecording,
  onIndexChange,
  onRunningChange,
  onReview,
  hideText,
  onHideTextChange,
}: {
  sentences: LessonSentence[];
  startIndex: number;
  locale: Locale;
  playSentence: (s: LessonSentence, rate?: number) => Promise<void>;
  scoreRecording: (r: RecordResult, s: LessonSentence) => Promise<ScoreBreakdown | null>;
  onIndexChange: (i: number) => void;
  onRunningChange: (running: boolean) => void;
  /** Open one sentence's result after the run (chips are clickable then). */
  onReview?: (i: number) => void;
  /** Lifted: the parent hides the sentence card's text while a run is on. */
  hideText: boolean;
  onHideTextChange: (v: boolean) => void;
}) {
  const c = copyFor(locale);
  const recorder = useRecorder();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [rate, setRate] = useState(1);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"listen" | "speak" | "scoring" | null>(null);
  const [at, setAt] = useState(startIndex);
  const [speakProgress, setSpeakProgress] = useState(0);
  const [results, setResults] = useState<Array<{ index: number; score: ScoreBreakdown | null }>>([]);
  const [finished, setFinished] = useState(false);
  const cancelled = useRef(false);
  const finishTurn = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!running) setAt(startIndex);
  }, [startIndex, running]);
  useEffect(() => () => {
    cancelled.current = true;
    cancelSpeech();
  }, []);

  async function run() {
    cancelled.current = false;
    setFinished(false);
    setResults([]);
    setRunning(true);
    onRunningChange(true);
    // Pin the view once: runner on top, sentence card right below. Nothing
    // else scrolls during the run.
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      for (let i = at; i < sentences.length; i++) {
        if (cancelled.current) break;
        const s = sentences[i];
        setAt(i);
        onIndexChange(i);
        setPhase("listen");
        await playSentence(s, rate);
        if (cancelled.current) break;
        await sleep(250);
        setPhase("speak");
        setSpeakProgress(0);
        await recorder.start();
        const window_ = (sentenceSeconds(s) / rate) * 1.5 + 1.5;
        const began = performance.now();
        await new Promise<void>((resolve) => {
          finishTurn.current = resolve;
          const tick = () => {
            if (cancelled.current || finishTurn.current !== resolve) return resolve();
            const p = (performance.now() - began) / 1000 / window_;
            setSpeakProgress(Math.min(1, p));
            if (p >= 1) resolve();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        finishTurn.current = null;
        const r = await recorder.stop();
        if (cancelled.current) break;
        setPhase("scoring");
        const score = await scoreRecording(r, s);
        setResults((prev) => [...prev, { index: i, score }]);
        await sleep(score?.passed ? 900 : 1600);
      }
      if (!cancelled.current) setFinished(true);
    } finally {
      setPhase(null);
      setRunning(false);
      onRunningChange(false);
    }
  }

  function stopRun() {
    cancelled.current = true;
    cancelSpeech();
    finishTurn.current?.();
  }

  const passed = results.filter((r) => r.score?.passed).length;
  const scored = results.filter((r) => r.score);
  const avg = scored.length
    ? Math.round(scored.reduce((sum, r) => sum + (r.score?.total ?? 0), 0) / scored.length)
    : null;
  const starSum = results.reduce((sum, r) => sum + (r.score ? (r.score.stars ?? starsFor(r.score)) : 0), 0);
  const tone = (score: ScoreBreakdown | null) =>
    score?.passed
      ? "bg-[var(--success)]"
      : score && (score.coverage ?? 0) >= 50
        ? "bg-[var(--warning)]"
        : score
          ? "bg-[var(--danger)]"
          : "bg-[var(--muted)]";

  return (
    <div ref={rootRef} className="scroll-mt-24 rounded-xl border border-primary/25 bg-primary/5 p-4">
      {!running ? (
        <div className="space-y-3">
          <RunOptions rate={rate} onRate={setRate} hideText={hideText} onHideText={onHideTextChange} c={c} />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run}>
              <Icon name="play" size={16} />
              {c.chainStart}
            </Button>
            <span className="text-xs font-bold text-muted">{c.fromSentence(at + 1)}</span>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-extrabold">
              <Icon name={phase === "speak" ? "mic" : phase === "listen" ? "volume" : "gauge"} size={16} />
              {phase === "speak" ? c.phaseSpeak : phase === "listen" ? c.phaseListen : c.phaseScoring}
              <span className="text-xs text-muted tabular-nums">
                {at + 1}/{sentences.length}
              </span>
            </p>
            <div className="flex gap-2">
              {phase === "speak" && (
                <Button variant="secondary" size="sm" onClick={() => finishTurn.current?.()}>
                  <Icon name="check" size={14} />
                  {c.chainDone}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={stopRun}>
                <Icon name="stop" size={14} />
                {c.chainStop}
              </Button>
            </div>
          </div>
          {phase === "speak" && (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--primary)_15%,var(--surface))]">
                <div className="h-full rounded-full bg-primary" style={{ width: `${speakProgress * 100}%` }} />
              </div>
              {recorder.interim && (
                <p lang="ja" className="mt-2 text-sm text-muted">{recorder.interim}</p>
              )}
            </>
          )}
        </div>
      )}
      {results.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {results.map(({ index, score }) => (
            <button
              key={index}
              type="button"
              disabled={running || !onReview}
              onClick={() => onReview?.(index)}
              title={`${index + 1}`}
              className={cn(
                "focus-ring rounded-md px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-white enabled:hover:brightness-110",
                tone(score),
              )}
            >
              <span className="opacity-75">{index + 1}·</span>
              {score ? score.total : "—"}
            </button>
          ))}
        </div>
      )}
      {!running && results.length > 0 && (
        <div className="mt-3 rounded-xl border border-border bg-card p-3">
          <p className="flex items-center gap-1.5 text-sm font-extrabold">
            <Icon name="trophy" size={15} />
            {finished ? c.chainFinished : c.summaryTitle}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            {[
              [c.summaryPassed, `${passed}/${results.length}`],
              [c.summaryAvg, avg ?? "—"],
              [c.summaryStars, `${starSum}/${results.length * 3}`],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-surface p-2">
                <p className="text-xl font-extrabold tabular-nums">{value}</p>
                <p className="text-[11px] font-bold text-muted">{label}</p>
              </div>
            ))}
          </div>
          {onReview && <p className="mt-2 text-xs text-muted">{c.chainReviewHint}</p>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Level 3 — full-lesson shadowing                                     */
/* ------------------------------------------------------------------ */

/** Katakana → hiragana for readability; drops the Latin-word wildcard. */
function toHiragana(text: string): string {
  return text
    .replace(/\uE000/g, "…")
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function LiveTranscript({ text, label }: { text: string; label: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [text]);
  return (
    <div>
      <p className="text-[11px] font-extrabold text-muted">{label}</p>
      <div
        ref={ref}
        lang="ja"
        className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-card px-3 py-2 text-sm leading-7"
      >
        {text}
      </div>
    </div>
  );
}

interface RunResult {
  transcript: string;
  total: number;
  accuracy: number;
  keptUp: number | null;
  score: LessonRunScore;
  keptUpPerSentence: boolean[] | null;
  newBest: boolean;
}

interface StoredBest {
  total: number;
  at: string;
}

const bestKey = (lessonId: string) => `shadowing:full-best:${lessonId}`;
const ECHO_KEY = "shadowing:echo-ok";
const ECHO_TTL_MS = 14 * 24 * 3600 * 1000;

/** A passed speaker check is remembered per device for two weeks. */
function echoVerified(): boolean {
  try {
    const at = Number(window.localStorage.getItem(ECHO_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < ECHO_TTL_MS;
  } catch {
    return false;
  }
}

function rememberEcho(ok: boolean) {
  try {
    if (ok) window.localStorage.setItem(ECHO_KEY, String(Date.now()));
    else window.localStorage.removeItem(ECHO_KEY);
  } catch {
    /* storage unavailable: the check simply runs again next time */
  }
}

function readBest(lessonId: string): StoredBest | null {
  try {
    const raw = window.localStorage.getItem(bestKey(lessonId));
    return raw ? (JSON.parse(raw) as StoredBest) : null;
  } catch {
    return null;
  }
}

function writeBest(lessonId: string, best: StoredBest) {
  try {
    window.localStorage.setItem(bestKey(lessonId), JSON.stringify(best));
  } catch {
    /* storage unavailable: the result is still shown */
  }
}

// Seconds after a sentence ends during which the learner may still be on it.
const SHADOW_LAG = 1.5;
const KEPT_UP_SHARE = 0.3;

export function FullLessonRun({
  lessonId,
  sentences,
  mediaUrl,
  locale,
  onPractice,
  onRunningChange,
  onSwitchToChain,
}: {
  lessonId: string;
  sentences: LessonSentence[];
  mediaUrl: string | null;
  locale: Locale;
  onPractice: (index: number) => void;
  onRunningChange: (running: boolean) => void;
  onSwitchToChain?: () => void;
}) {
  const c = copyFor(locale);
  const recorder = useRecorder({ longForm: true });
  const [rate, setRate] = useState(1);
  const [hideText, setHideText] = useState(false);
  const probe = useRecorder();
  const [echo, setEcho] = useState<"unknown" | "checking" | "ok" | "leak">("unknown");
  const [leaked, setLeaked] = useState(false);
  const [phase, setPhase] = useState<"idle" | "running" | "scoring">("idle");
  const [playing, setPlaying] = useState(-1);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [best, setBest] = useState<StoredBest | null>(null);
  const cancelled = useRef(false);
  const stopEarly = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => setBest(readBest(lessonId)), [lessonId]);
  useEffect(() => {
    if (echoVerified()) setEcho("ok");
  }, []);
  useEffect(() => () => {
    cancelled.current = true;
    audioRef.current?.pause();
    cancelSpeech();
  }, []);

  const continuous =
    Boolean(mediaUrl) &&
    sentences.every((s) => s.audio_start != null && s.audio_end != null && !s.audio_url);

  /** Plays the lesson; returns each sentence's [start, end] in recording time. */
  async function playLesson(t0: number): Promise<Array<{ start: number; end: number }>> {
    const now = () => (performance.now() - t0) / 1000;
    const windows = sentences.map(() => ({ start: -1, end: -1 }));
    if (continuous && mediaUrl) {
      const first = sentences[0].audio_start!;
      const last = sentences[sentences.length - 1].audio_end!;
      const audio = new Audio(mediaUrl);
      audioRef.current = audio;
      audio.playbackRate = rate;
      await new Promise<void>((resolve) => {
        const done = () => {
          audio.pause();
          resolve();
        };
        stopEarly.current = done;
        audio.ontimeupdate = () => {
          const t = audio.currentTime;
          sentences.forEach((s, i) => {
            if (windows[i].start < 0 && t >= s.audio_start!) {
              windows[i].start = now();
              setPlaying(i);
            }
            if (windows[i].end < 0 && t >= s.audio_end!) windows[i].end = now();
          });
          if (t >= last || cancelled.current) done();
        };
        audio.onended = done;
        audio.onerror = done;
        audio.currentTime = first;
        audio.play().catch(done);
      });
    } else {
      let stop = false;
      stopEarly.current = () => {
        stop = true;
        audioRef.current?.pause();
        cancelSpeech();
      };
      for (let i = 0; i < sentences.length && !stop && !cancelled.current; i++) {
        const s = sentences[i];
        setPlaying(i);
        windows[i].start = now();
        if (s.audio_url) {
          const audio = new Audio(s.audio_url);
          audioRef.current = audio;
          audio.playbackRate = rate;
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.onpause = () => resolve();
            audio.play().catch(() => resolve());
          });
        } else if (mediaUrl && s.audio_start != null && s.audio_end != null) {
          const audio = audioRef.current?.src === mediaUrl ? audioRef.current : new Audio(mediaUrl);
          audioRef.current = audio;
          audio.playbackRate = rate;
          audio.currentTime = s.audio_start;
          await audio.play().catch(() => undefined);
          await sleep(((s.audio_end - s.audio_start) * 1000) / rate);
          audio.pause();
        } else {
          await speakJa(s.ja_text, rate).catch(() => undefined);
        }
        windows[i].end = now();
        await sleep(200);
      }
    }
    // Sentences never reached (stopped early) get an empty window.
    return windows.map((w) => (w.start < 0 ? { start: 0, end: 0 } : { start: w.start, end: w.end < 0 ? now() : w.end }));
  }

  /** Plays ~3 s of the first sentence through the speakers. */
  async function playSample() {
    const s = sentences[0];
    if (!s) return;
    const clip = s.audio_url
      ? { url: s.audio_url, from: 0, length: 3 }
      : mediaUrl && s.audio_start != null && s.audio_end != null
        ? { url: mediaUrl, from: s.audio_start, length: Math.min(3, s.audio_end - s.audio_start) }
        : null;
    if (clip) {
      const audio = new Audio(clip.url);
      audioRef.current = audio;
      audio.currentTime = clip.from;
      await audio.play().catch(() => undefined);
      await sleep(clip.length * 1000);
      audio.pause();
      return;
    }
    await speakJa(s.ja_text).catch(() => undefined);
  }

  /**
   * Speaker-leak check. Chrome's speech recogniser opens the mic itself, so
   * the only reliable test is the real one: play the model while the learner
   * stays silent and see whether the recogniser transcribes anything.
   */
  async function checkEcho(): Promise<boolean> {
    setEcho("checking");
    try {
      await probe.start();
      await sleep(300);
      await playSample();
      await sleep(700);
      const r = await probe.stop();
      const heard = r.transcript.replace(/[\s、。！？!?,.]/gu, "");
      const ok = heard.length < 3;
      setEcho(ok ? "ok" : "leak");
      rememberEcho(ok);
      return ok;
    } catch {
      setEcho("unknown");
      return false;
    }
  }

  async function start() {
    cancelled.current = false;
    setError(null);
    setResult(null);
    setLeaked(false);
    if (echo !== "ok" && !(await checkEcho())) return;
    setPhase("running");
    onRunningChange(true);
    let r: RecordResult | null = null;
    let windows: Array<{ start: number; end: number }> = [];
    try {
      await recorder.start();
      const t0 = performance.now();
      windows = await playLesson(t0);
      if (!cancelled.current) await sleep(SHADOW_LAG * 1000);
      r = await recorder.stop();
    } finally {
      setPlaying(-1);
      stopEarly.current = null;
    }
    if (cancelled.current || !r) {
      setPhase("idle");
      onRunningChange(false);
      return;
    }
    setPhase("scoring");
    try {
      if (!r.transcript.trim()) throw new Error("no_transcript");
      const reached = windows.filter((w) => w.end > w.start).length;
      const played = sentences.slice(0, Math.max(1, reached));
      const [res, envelope] = await Promise.all([
        fetch("/api/score/lesson", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sentences: played.map((s) => s.ja_text), transcript: r.transcript }),
        }),
        activityEnvelope(r.audioUrl),
      ]);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "score_failed");
      const score = body as LessonRunScore;
      const keptUpPerSentence = envelope
        ? windows.slice(0, played.length).map((w) => activeShare(envelope, w.start + 0.2, w.end + SHADOW_LAG) >= KEPT_UP_SHARE)
        : null;
      const keptUp = keptUpPerSentence
        ? keptUpPerSentence.filter(Boolean).length / Math.max(1, keptUpPerSentence.length)
        : null;
      // Stopping early scores only what was played, but the lesson total is
      // scaled by how much of the lesson was actually covered.
      const share = played.length / sentences.length;
      const total = Math.round(lessonRunTotal(score.accuracy, keptUp) * share);
      // Leak guard: sentences recognised well while the learner's own mic
      // track was silent can only have come from the speakers.
      const ghost = keptUpPerSentence
        ? score.sentences.filter((s) => s.status === "good" && !keptUpPerSentence[s.index]).length
        : 0;
      const runLeaked = ghost >= Math.max(2, Math.ceil(played.length * 0.2));
      if (runLeaked) {
        setLeaked(true);
        rememberEcho(false);
        setEcho("unknown");
      }
      const previous = readBest(lessonId);
      const newBest = !runLeaked && (!previous || total > previous.total);
      if (newBest) {
        const next = { total, at: new Date().toISOString() };
        writeBest(lessonId, next);
        setBest(next);
      }
      setResult({ transcript: r.transcript, total, accuracy: score.accuracy, keptUp, score, keptUpPerSentence, newBest });
    } catch (e) {
      setError(e instanceof Error && e.message === "no_transcript" ? c.noTranscript : c.scoreFailed);
    } finally {
      setPhase("idle");
      onRunningChange(false);
    }
  }

  function cancel() {
    cancelled.current = true;
    stopEarly.current?.();
  }

  const statusTone = {
    good: "bg-[var(--success)] text-white",
    partial: "bg-[var(--warning)] text-white",
    missed: "bg-[var(--danger)] text-white",
  } as const;

  return (
    <div className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
      {phase === "idle" && (
        <div className="space-y-3">
          <RunOptions rate={rate} onRate={setRate} hideText={hideText} onHideText={setHideText} c={c} />
          {echo === "unknown" && <p className="text-xs text-muted">🔈 {c.echoIntro}</p>}
          {echo === "checking" && (
            <p role="status" className="flex items-center gap-2 text-sm font-bold">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--warning)]" />
              {c.echoChecking}
            </p>
          )}
          {echo === "ok" && <p className="text-xs font-bold text-[var(--success)]">✓ {c.echoOk}</p>}
          {echo === "leak" && (
            <div role="alert" className="rounded-lg bg-[var(--warning-soft)] p-3 text-sm text-[var(--warning)]">
              <p>🎧 {c.echoLeak}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void checkEcho()}>
                  <Icon name="retry" size={14} />
                  {c.echoRetry}
                </Button>
                {onSwitchToChain && (
                  <Button variant="secondary" size="sm" onClick={onSwitchToChain}>
                    <Icon name="arrow-right" size={14} />
                    {c.toChain}
                  </Button>
                )}
              </div>
            </div>
          )}
          {leaked && (
            <p role="alert" className="rounded-lg bg-[var(--warning-soft)] p-3 text-sm text-[var(--warning)]">
              {c.leakedRun}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={start} disabled={echo === "checking" || echo === "leak"}>
              <Icon name="mic" size={16} />
              {result ? c.retry : c.fullStart}
            </Button>
            {best && <span className="text-xs font-bold text-muted">{c.best(best.total)}</span>}
          </div>
          {error && <p role="alert" className="text-sm text-[var(--warning)]">{error}</p>}
        </div>
      )}

      {phase === "running" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-extrabold">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--danger)]" />
              {c.fullListening}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => stopEarly.current?.()}>
                <Icon name="check" size={14} />
                {c.fullStop}
              </Button>
              <Button variant="outline" size="sm" onClick={cancel}>
                <Icon name="stop" size={14} />
                {c.fullCancel}
              </Button>
            </div>
          </div>
          <ol className="max-h-80 space-y-1.5 overflow-y-auto rounded-lg bg-card p-3">
            {sentences.map((s, i) => (
              <li
                key={s.id}
                ref={(el) => {
                  if (el && i === playing) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }}
                lang="ja"
                className={cn(
                  "rounded-md px-2 py-1 text-sm transition-colors",
                  i === playing ? "bg-primary/15 font-bold text-fg" : i < playing ? "text-muted" : "text-muted/70",
                )}
              >
                <span className="mr-2 text-[11px] tabular-nums text-muted">{i + 1}</span>
                {hideText && i >= playing ? "●".repeat(Math.min(14, Math.ceil(s.ja_text.length / 2))) : s.ja_text}
              </li>
            ))}
          </ol>
          {recorder.interim && <LiveTranscript text={recorder.interim} label={c.liveTranscript} />}
        </div>
      )}

      {phase === "scoring" && <p role="status" className="text-sm font-bold">{c.fullScoring}</p>}

      {result && phase === "idle" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-extrabold">{c.resultTitle}</p>
            {result.newBest && (
              <span className="animate-pop rounded-full bg-[var(--success-soft)] px-2.5 py-0.5 text-xs font-extrabold text-[var(--success)]">
                <Icon name="trophy" size={12} className="mr-1 inline" />
                {c.newBest}
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            {[
              [c.total, result.total],
              [c.accuracy, result.accuracy],
              [c.keptUp, result.keptUp == null ? "—" : Math.round(result.keptUp * 100)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-surface p-2">
                <p className="text-2xl font-extrabold tabular-nums">{value}</p>
                <p className="text-[11px] font-bold text-muted">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-center">
            <StarRow
              stars={starsFor({
                passed: result.total >= 80,
                pronunciation: result.accuracy,
                speed: result.keptUp == null ? null : result.keptUp * 100,
                intonation: null,
                total: result.total,
              })}
              size={22}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {result.score.sentences.map((s) => (
              <button
                key={s.index}
                type="button"
                onClick={() => onPractice(s.index)}
                title={`${s.index + 1}: ${s.accuracy}`}
                className={cn(
                  "focus-ring relative grid h-9 min-w-9 place-items-center rounded-lg px-2 text-xs font-extrabold tabular-nums",
                  statusTone[s.status],
                )}
              >
                {s.index + 1}
                {result.keptUpPerSentence && !result.keptUpPerSentence[s.index] && (
                  <span aria-hidden className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-[var(--c-amber)]" />
                )}
              </button>
            ))}
          </div>
          <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[var(--success)]" />{c.legendGood}</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[var(--warning)]" />{c.legendPartial}</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[var(--danger)]" />{c.legendMissed}</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--c-amber)]" />{c.keptUp} ✗</span>
          </p>
          <p className="mt-1 text-xs text-muted">{c.heatHint}</p>

          <div className="mt-4">
            <p className="text-xs font-extrabold">{c.transcriptTitle}</p>
            <p
              lang="ja"
              className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-7"
            >
              {result.transcript}
            </p>
          </div>

          <details className="mt-4" open>
            <summary className="cursor-pointer text-xs font-extrabold">{c.compareTitle}</summary>
            <ol className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1">
              {result.score.sentences.map((s) => (
                <li key={s.index}>
                  <button
                    type="button"
                    onClick={() => onPractice(s.index)}
                    className="focus-ring flex w-full items-start gap-2 rounded-lg border border-border bg-surface p-2 text-left hover:border-primary/40"
                  >
                    <span
                      className={cn(
                        "grid h-6 min-w-6 shrink-0 place-items-center rounded-md px-1 text-[11px] font-extrabold tabular-nums",
                        statusTone[s.status],
                      )}
                    >
                      {s.index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span lang="ja" className="block text-sm font-semibold">
                        {sentences[s.index]?.ja_text}
                      </span>
                      <span lang="ja" className="mt-0.5 block text-xs text-muted">
                        {c.heard}: {s.spoken ? toHiragana(s.spoken) : c.heardNothing}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-extrabold tabular-nums text-muted">{s.accuracy}</span>
                  </button>
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
    </div>
  );
}

export function modeCopy(locale: Locale) {
  return copyFor(locale);
}
