"use client";

import { useI18n } from "@/components/i18n/useI18n";
import { CardTitle } from "@/components/ui/card";
import { MascotBadge } from "@/components/ui/mascot";
import { levelMascot, levelProgress, levelTitle } from "@/lib/gamification/level";

export function LevelCard({ totalXp }: { totalXp: number }) {
  const { locale, localeTag, dictionary: m } = useI18n();
  const p = levelProgress(totalXp);
  const mascot = levelMascot(p.level);
  return (
    <div className="tile p-5" style={{ ["--tile-c" as string]: mascot.accent }}>
      <div className="flex items-start justify-between">
        <CardTitle>{m.levelCard.title}</CardTitle>
        <MascotBadge slug={mascot.slug} accent={mascot.accent} size={52} />
      </div>
      <div className="mt-3">
        <span className="text-3xl font-extrabold" style={{ color: mascot.accent }}>
          Lv.{p.level}
        </span>
        <p className="text-sm font-semibold text-gradient">
          {levelTitle(p.level, locale)}
        </p>
      </div>
      <div className="mt-3">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--muted)_22%,transparent)]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${p.pct}%`,
              background: `linear-gradient(90deg, ${mascot.accent}, var(--g3))`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted tabular-nums">
          {m.levelCard.toNext(p.toNext.toLocaleString(localeTag), p.level + 1)}
        </p>
      </div>
    </div>
  );
}
