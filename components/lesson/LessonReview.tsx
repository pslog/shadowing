"use client";

import { useCallback, useRef, useState } from "react";
import { useData } from "@/lib/store/DataProvider";
import {
  bestAttemptForSentence,
  lessonAverageScore,
  sentencesForLesson,
} from "@/lib/store/selectors";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

/**
 * Shown when every sentence in a lesson has been passed. Recaps the lesson
 * average and plays back the scored recordings as one continuous run, in
 * sentence order — each clip auto-advances to the next, highlighting the line
 * currently playing.
 *
 * Uses the in-session recording blobs (no persistence): playback works while
 * the tab stays open.
 */
export function LessonReview({ lessonId }: { lessonId: string }) {
  const { state } = useData();
  const sentences = sentencesForLesson(state, lessonId);
  const average = lessonAverageScore(state, lessonId);

  const items = sentences.map((s) => {
    const best = bestAttemptForSentence(state, s.id);
    return {
      sentence: s,
      url: best?.recording_url ?? null,
      score: best?.total_score ?? null,
    };
  });
  const playable = items
    .map((it, i) => ({ ...it, i }))
    .filter((it) => it.url);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState<number | null>(null); // item index

  const playAt = useCallback(
    (itemIndex: number) => {
      const url = items[itemIndex]?.url;
      const el = audioRef.current;
      if (!url || !el) return;
      el.src = url;
      el.play().catch(() => setPlaying(null));
      setPlaying(itemIndex);
    },
    [items],
  );

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(null);
  }, []);

  const handleEnded = useCallback(() => {
    const next = playable.find((p) => playing != null && p.i > playing);
    if (next) playAt(next.i);
    else setPlaying(null);
  }, [playable, playing, playAt]);

  const isRunning = playing != null;
  const noAudio = playable.length === 0;

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[var(--success)]/25 bg-card shadow-[var(--shadow-md)]">
      <audio ref={audioRef} onEnded={handleEnded} className="hidden" />

      <div className="brand-gradient relative overflow-hidden px-6 py-5 text-white">
        <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full border border-white/20" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.22em] text-white/75">
              <Icon name="trophy" size={14} />
              レッスン完了
            </p>
            <h2 className="mt-1 text-2xl font-extrabold">通して聞き返す</h2>
            <p className="mt-1 text-sm text-white/82">
              自分の録音を順番に一気に再生します。
            </p>
          </div>
          <div className="shrink-0 text-center">
            <div className="text-4xl font-extrabold tabular-nums leading-none">
              {average ?? "—"}
            </div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-white/75">
              平均点
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <Button
          variant={isRunning ? "danger" : "primary"}
          onClick={() => (isRunning ? stop() : playAt(playable[0].i))}
          disabled={noAudio}
          className="w-full"
        >
          <Icon name={isRunning ? "stop" : "volume"} size={18} filled={isRunning} />
          {isRunning ? "停止" : "通しで再生"}
        </Button>

        <div className="mt-3 space-y-1.5">
          {items.map((it, i) => {
            const active = playing === i;
            return (
              <button
                key={it.sentence.id}
                type="button"
                onClick={() => it.url && playAt(i)}
                disabled={!it.url}
                className={[
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-surface/70 hover:bg-card disabled:opacity-60",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold tabular-nums",
                    active ? "bg-primary text-white" : "bg-[var(--success)] text-white",
                  ].join(" ")}
                >
                  {active ? <Icon name="volume" size={14} filled /> : i + 1}
                </span>
                <p
                  lang="ja"
                  className="min-w-0 flex-1 truncate text-sm font-semibold text-fg"
                  title={it.sentence.ja_text}
                >
                  {it.sentence.ja_text}
                </p>
                <span className="shrink-0 text-sm font-extrabold tabular-nums text-primary">
                  {it.score ?? "—"}
                  <span className="text-[11px] font-bold text-muted">点</span>
                </span>
              </button>
            );
          })}
        </div>

        {noAudio && (
          <p className="px-1 pt-2 text-center text-xs text-muted">
            録音の再生はこのセッション中のみ可能です（再読み込みで消えます）。
          </p>
        )}
      </div>
    </section>
  );
}
