"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { useRecorder, type RecordResult } from "@/lib/speech/useRecorder";
import { cn } from "@/lib/cn";

export function AudioRecorder({
  disabled,
  onResult,
  compact = false,
  inline = false,
  className,
  hideNotes = false,
}: {
  disabled?: boolean;
  onResult: (r: RecordResult) => void;
  compact?: boolean;
  inline?: boolean;
  className?: string;
  /** Inline mode: suppress the "browser unsupported" note so the parent can place it. */
  hideNotes?: boolean;
}) {
  const { status, interim, error, sttSupported, start, stop } = useRecorder();
  const [busy, setBusy] = useState(false);
  const recording = status === "recording";
  const processing = status === "processing" || busy;

  async function handleStop() {
    setBusy(true);
    try {
      onResult(await stop());
    } finally {
      setBusy(false);
    }
  }

  // Inline mode: a normal-sized button that sits in the same row as the
  // "listen" buttons. Live transcript / errors / notes drop onto their own line
  // below (basis-full) so the button row stays tidy.
  if (inline) {
    return (
      <>
        <button
          type="button"
          onClick={recording ? handleStop : start}
          disabled={disabled || processing}
          aria-label={recording ? "録音を停止" : "録音を開始"}
          className={buttonClasses(recording ? "danger" : "primary", "md", className)}
        >
          {processing ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Icon name={recording ? "stop" : "mic"} size={18} filled={recording} />
          )}
          {processing ? "処理中" : recording ? "停止" : "録音"}
        </button>

        {recording && interim && (
          <p
            lang="ja"
            className="basis-full rounded-xl bg-surface px-3 py-2 text-center text-sm text-muted"
          >
            {interim}
          </p>
        )}
        {error && <p className="basis-full text-center text-sm text-danger">{error}</p>}
        {!sttSupported && !hideNotes && (
          <p className="basis-full text-center text-xs text-[var(--warning)]">
            このブラウザは音声認識に非対応です。ChromeまたはEdgeを推奨します。
          </p>
        )}
      </>
    );
  }

  return (
    <div className={cn("flex flex-col items-center", compact ? "gap-2" : "gap-3")}>
      <div className="relative grid place-items-center">
        {recording && (
          <>
            <span
              className={cn(
                "absolute rounded-full bg-[var(--danger)]/40",
                compact ? "h-18 w-18" : "h-24 w-24",
              )}
              style={{ animation: "pulse-ring 1.6s ease-out infinite" }}
            />
            <span
              className={cn(
                "absolute rounded-full bg-[var(--danger)]/30",
                compact ? "h-18 w-18" : "h-24 w-24",
              )}
              style={{ animation: "pulse-ring 1.6s ease-out infinite 0.5s" }}
            />
          </>
        )}

        <button
          type="button"
          onClick={recording ? handleStop : start}
          disabled={disabled || processing}
          aria-label={recording ? "録音を停止" : "録音を開始"}
          className={cn(
            "focus-ring relative grid place-items-center rounded-full text-white transition-all duration-200 active:scale-95 disabled:opacity-60",
            compact ? "h-18 w-18" : "h-24 w-24",
            recording
              ? "bg-[var(--danger)] shadow-[0_10px_40px_-8px_rgba(220,38,38,0.7)]"
              : "brand-gradient shadow-[var(--shadow-glow)] hover:-translate-y-0.5",
          )}
        >
          {processing ? (
            <span className={cn(
              "animate-spin rounded-full border-white/40 border-t-white",
              compact ? "h-5 w-5 border-2" : "h-7 w-7 border-[3px]",
            )} />
          ) : (
            <Icon name={recording ? "stop" : "mic"} size={compact ? 26 : 34} filled={recording} />
          )}
        </button>
      </div>

      <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
        {processing
          ? "処理中..."
          : recording
            ? compact
              ? "話し終わったら停止"
              : "聞いています...話し終わったら停止してください"
            : "押して録音"}
      </p>

      {recording && interim && (
        <p
          lang="ja"
          className="max-w-md rounded-xl bg-surface px-3 py-2 text-center text-sm text-muted"
        >
          {interim}
        </p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {(!compact || !sttSupported) && (
        <p
          className={cn(
            "max-w-md text-center text-xs",
            sttSupported ? "text-muted" : "text-[var(--warning)]",
          )}
        >
          {sttSupported
            ? "ブラウザの音声認識で日本語（ja-JP）を認識します。"
            : "このブラウザは音声認識に対応していません。採点は推定で行います。ChromeまたはEdgeを使うと文字起こしできます。"}
        </p>
      )}
    </div>
  );
}
