import { cn } from "@/lib/cn";
import type { LessonSentence } from "@/lib/types";

export function SentenceCard({
  sentence,
  index,
  active,
  passed,
  bestScore,
  onClick,
}: {
  sentence: LessonSentence;
  index: number;
  active: boolean;
  passed: boolean;
  bestScore: number | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-ring",
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:bg-surface",
      )}
    >
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-medium",
          passed
            ? "bg-[var(--success)] text-white"
            : "bg-surface text-muted border border-border",
        )}
      >
        {passed ? "✓" : index + 1}
      </span>
      <span lang="ja" className="min-w-0 flex-1 truncate text-sm">
        {sentence.ja_text}
      </span>
      {bestScore != null && (
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            passed ? "text-[var(--success)]" : "text-muted",
          )}
        >
          {bestScore}
        </span>
      )}
    </button>
  );
}
