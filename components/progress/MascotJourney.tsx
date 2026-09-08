"use client";

// Where the learner stands on the mascot ladder: who they are now, how far the
// next companion is, and nothing else.
//
// This is the progress-page reading of the level data — a status line. The
// dashboard draws the same numbers as a climb up Fuji
// (`components/dashboard/LevelMountain.tsx`) because there the question is
// "what am I working toward today"; here it is "where am I".

import { useI18n } from "@/components/i18n/useI18n";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Mascot, MascotBadge } from "@/components/ui/mascot";
import {
  LEVEL_MILESTONES,
  levelMascot,
  levelTitle,
} from "@/lib/gamification/level";

export function MascotJourney({
  currentLevel,
  totalXp,
}: {
  currentLevel: number;
  totalXp: number;
}) {
  const { locale, localeTag, dictionary } = useI18n();
  const t = dictionary.progress;
  const currentMascot = levelMascot(currentLevel);
  const currentMilestone = [...LEVEL_MILESTONES]
    .reverse()
    .find((item) => item.level <= currentLevel) ?? LEVEL_MILESTONES[0];
  const nextMilestone = LEVEL_MILESTONES.find((item) => item.level > currentLevel);
  const journeySpan = nextMilestone
    ? Math.max(1, nextMilestone.minXp - currentMilestone.minXp)
    : 1;
  const pct = nextMilestone
    ? Math.min(100, Math.round(((totalXp - currentMilestone.minXp) / journeySpan) * 100))
    : 100;
  const remaining = nextMilestone ? Math.max(0, nextMilestone.minXp - totalXp) : 0;

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid md:grid-cols-[0.82fr_1.35fr_0.82fr]">
        <div className="flex items-center gap-4 border-b border-border p-5 md:border-b-0 md:border-r md:p-6">
          <MascotBadge
            slug={currentMascot.slug}
            accent={currentMascot.accent}
            size={62}
          />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              {t.currentPosition}
            </p>
            <p className="mt-1 text-lg font-extrabold">Lv.{currentLevel}</p>
            <p className="text-sm font-semibold text-primary">
              {levelTitle(currentLevel, locale)}
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden bg-[linear-gradient(135deg,color-mix(in_srgb,var(--surface)_72%,white),color-mix(in_srgb,var(--primary)_9%,white))] p-5 md:p-6">
          <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full border-[22px] border-primary/[0.05]" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold tracking-[-0.02em]">{t.roadmapTitle}</h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                {nextMilestone
                  ? `${t.remainingXp(remaining.toLocaleString(localeTag))} · ${t.toNextLevel(nextMilestone.level)}`
                  : t.maxLevel}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-primary/15 bg-card px-3 py-1 text-xs font-extrabold tabular-nums text-primary">
              {pct}%
            </span>
          </div>
          <div className="relative mt-5 h-2.5 overflow-hidden rounded-full bg-card shadow-[inset_0_0_0_1px_var(--border)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--accent))] transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-muted">
            <span>Lv.{currentMilestone.level}</span>
            <Icon name="arrow-right" size={15} className="text-primary" />
            <span>{nextMilestone ? `Lv.${nextMilestone.level}` : `Lv.${currentLevel}`}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 border-t border-border p-5 md:border-l md:border-t-0 md:p-6">
          {nextMilestone ? (
            <>
              <MascotBadge
                slug={nextMilestone.mascot.slug}
                accent={nextMilestone.mascot.accent}
                size={62}
                dimmed
              />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                  {t.nextCompanion}
                </p>
                <p className="mt-1 text-lg font-extrabold">Lv.{nextMilestone.level}</p>
                <p className="text-sm font-semibold text-muted">
                  {levelTitle(nextMilestone.level, locale)}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Mascot slug={currentMascot.slug} size={48} />
              <p className="text-sm font-bold text-primary">{t.maxLevel}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
