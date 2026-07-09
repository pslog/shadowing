"use client";

import { useRef, useState } from "react";
import { useData } from "@/lib/store/DataProvider";
import { lessonById, sentencesForLesson } from "@/lib/store/selectors";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

interface Row {
  id: string;
  ja: string;
  start: number | null;
  end: number | null;
}

const show = (x: number | null) =>
  x == null ? "" : Math.round(x * 1000) / 1000;

/**
 * Admin tool to fine-tune per-sentence audio timing (audio_start/audio_end)
 * against the full lesson audio. Play a slice, nudge the numbers, or capture
 * the player's current position as the start/end. Saves changed rows only, so
 * untouched exact timestamps are preserved.
 */
export function SentenceTimingEditor({ lessonId }: { lessonId: string }) {
  const { state, updateSentenceTiming } = useData();
  const lesson = lessonById(state, lessonId);
  const sentences = sentencesForLesson(state, lessonId);

  const audioRef = useRef<HTMLAudioElement>(null);
  const stopAtRef = useRef<number | null>(null);
  const [rows, setRows] = useState<Row[]>(() =>
    sentences.map((s) => ({
      id: s.id,
      ja: s.ja_text,
      start: s.audio_start,
      end: s.audio_end,
    })),
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);

  if (!lesson?.media_url) {
    return (
      <Card>
        <CardTitle>文のタイミング調整</CardTitle>
        <p className="mt-2 text-sm text-muted">
          このレッスンには音声（media_url）がないため調整できません。
        </p>
      </Card>
    );
  }

  const set = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  function playSlice(row: Row) {
    const a = audioRef.current;
    if (!a || row.start == null) return;
    a.currentTime = row.start;
    stopAtRef.current = row.end;
    a.play().catch(() => {});
  }

  function onTimeUpdate() {
    const a = audioRef.current;
    if (a && stopAtRef.current != null && a.currentTime >= stopAtRef.current) {
      a.pause();
      stopAtRef.current = null;
    }
  }

  function save() {
    rows.forEach((r) => {
      const orig = sentences.find((s) => s.id === r.id);
      const changed =
        Math.abs((r.start ?? 0) - (orig?.audio_start ?? 0)) > 1e-4 ||
        Math.abs((r.end ?? 0) - (orig?.audio_end ?? 0)) > 1e-4;
      if (changed) updateSentenceTiming(r.id, r.start, r.end);
    });
    setSavedAt(Date.now());
  }

  const field =
    "w-24 rounded-lg border border-border bg-card px-2 py-1 text-sm tabular-nums focus-ring";

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>文のタイミング調整</CardTitle>
        <Button onClick={save} size="sm">
          <Icon name="check" size={15} />
          タイミングを保存
        </Button>
      </div>
      <p className="text-xs text-muted">
        音声をスクラブして位置を確認 → 各文の「区間再生」で確認し、必要なら開始/終了（秒）を微調整、または現在位置を取り込みます。
      </p>

      <audio
        ref={audioRef}
        src={lesson.media_url}
        controls
        className="h-10 w-full"
        onTimeUpdate={onTimeUpdate}
      />

      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/70 px-3 py-2"
          >
            <span className="w-6 shrink-0 text-xs font-bold tabular-nums text-muted">
              {i + 1}
            </span>
            <p lang="ja" className="min-w-0 flex-1 truncate text-sm" title={r.ja}>
              {r.ja}
            </p>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.05"
                value={show(r.start)}
                onChange={(e) =>
                  set(i, { start: e.target.value === "" ? null : Number(e.target.value) })
                }
                className={field}
                aria-label="開始秒"
              />
              <button
                type="button"
                title="現在位置を開始に"
                onClick={() => set(i, { start: audioRef.current?.currentTime ?? r.start })}
                className="focus-ring rounded-lg border border-border px-1.5 py-1 text-xs hover:bg-card"
              >
                ⇤
              </button>
              <span className="text-muted">–</span>
              <input
                type="number"
                step="0.05"
                value={show(r.end)}
                onChange={(e) =>
                  set(i, { end: e.target.value === "" ? null : Number(e.target.value) })
                }
                className={field}
                aria-label="終了秒"
              />
              <button
                type="button"
                title="現在位置を終了に"
                onClick={() => set(i, { end: audioRef.current?.currentTime ?? r.end })}
                className="focus-ring rounded-lg border border-border px-1.5 py-1 text-xs hover:bg-card"
              >
                ⇥
              </button>
              <Button variant="secondary" size="sm" onClick={() => playSlice(r)}>
                <Icon name="play" size={14} />
                区間
              </Button>
            </div>
          </div>
        ))}
      </div>

      {savedAt && (
        <p className="text-xs font-semibold text-[var(--success)]">
          保存しました。
        </p>
      )}
    </Card>
  );
}
