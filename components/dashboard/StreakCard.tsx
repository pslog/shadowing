"use client";

import { useI18n } from "@/components/i18n/useI18n";
import { CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

export function StreakCard({
  current,
  longest,
  keptToday,
}: {
  current: number;
  longest: number;
  keptToday: boolean;
}) {
  const { dictionary: m } = useI18n();
  const copy = m.streakCard;

  return (
    <div className="tile p-5" style={{ ["--tile-c" as string]: "var(--c-amber)" }}>
      <div className="flex items-start justify-between">
        <CardTitle>{copy.title}</CardTitle>
        <span className="tile-icon h-11 w-11">
          <Icon name="flame" size={22} filled />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-4xl font-extrabold tabular-nums text-[var(--c-amber)]">
          {current}
        </span>
        <span className="text-muted">{copy.day}</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {keptToday ? copy.kept : current > 0 ? copy.continue : copy.start}
      </p>
      <p className="mt-1 text-xs text-muted">
        {copy.best}: {longest}
        {copy.day}
      </p>
    </div>
  );
}
