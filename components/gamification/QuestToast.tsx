"use client";

// A small, self-dismissing banner for "you just cleared a quest".
//
// Quest completions happen in three different screens (the player, the reading
// check, the vocabulary drill), and none of them can afford a blocking dialog —
// the learner is mid-flow and about to answer the next item. This sits above
// the content, says what was earned, and gets out of the way on its own.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/i18n/useI18n";
import { Icon } from "@/components/ui/icon";
import { PERFECT_DAY_XP, QUEST_XP, type QuestId } from "@/lib/gamification/quests";

export interface QuestCelebration {
  quests: QuestId[];
  perfect: boolean;
}

/** True when there is anything worth celebrating — saves callers an `if`. */
export function hasCelebration(c: {
  questsCompletedNow: QuestId[];
  perfectDayNow: boolean;
}): boolean {
  return c.questsCompletedNow.length > 0 || c.perfectDayNow;
}

const DISMISS_MS = 5200;

export function QuestToast({
  celebration,
  onDone,
}: {
  celebration: QuestCelebration | null;
  onDone: () => void;
}) {
  const { dictionary: m } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(onDone, DISMISS_MS);
    return () => clearTimeout(timer);
  }, [celebration, onDone]);

  if (!mounted || !celebration) return null;

  const t = m.quests;
  const questName: Record<QuestId, string> = {
    shadowing: t.shadowingTitle,
    reading: t.readingTitle,
    vocab: t.vocabTitle,
  };

  const title = celebration.perfect
    ? t.toastPerfect
    : t.toastQuest(questName[celebration.quests[0]] ?? "");
  const body = celebration.perfect
    ? t.toastPerfectBody(PERFECT_DAY_XP)
    : `+${QUEST_XP[celebration.quests[0]] ?? 0} XP`;
  const tone = celebration.perfect ? "var(--c-violet)" : "var(--success)";

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="animate-in pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4"
    >
      <div
        className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-[var(--shadow-md)]"
        style={{
          borderColor: `color-mix(in srgb, ${tone} 42%, transparent)`,
          background: `color-mix(in srgb, ${tone} 7%, var(--card))`,
        }}
      >
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{
            color: tone,
            background: `color-mix(in srgb, ${tone} 15%, transparent)`,
          }}
        >
          <Icon
            name={celebration.perfect ? "trophy" : "check"}
            size={20}
            strokeWidth={2.6}
            filled={celebration.perfect}
          />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-fg">{title}</p>
          <p className="mt-0.5 text-xs font-bold tabular-nums" style={{ color: tone }}>
            {body}
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          aria-label={t.dismiss}
          className="focus-ring -mr-1 ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-[color-mix(in_srgb,var(--muted)_12%,transparent)]"
        >
          <Icon name="check" size={15} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
