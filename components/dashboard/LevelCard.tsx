import { CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { levelProgress, levelTitle } from "@/lib/gamification/level";

export function LevelCard({ totalXp }: { totalXp: number }) {
  const p = levelProgress(totalXp);
  return (
    <div className="tile p-5" style={{ ["--tile-c" as string]: "var(--c-violet)" }}>
      <div className="flex items-start justify-between">
        <CardTitle>レベル</CardTitle>
        <span className="tile-icon h-11 w-11">
          <Icon name="sparkles" size={20} filled />
        </span>
      </div>
      <div className="mt-3">
        <span className="text-3xl font-extrabold text-[var(--c-violet)]">
          Lv.{p.level}
        </span>
        <p className="text-sm font-semibold text-gradient">{levelTitle(p.level)}</p>
      </div>
      <div className="mt-3">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--muted)_22%,transparent)]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${p.pct}%`,
              background: "linear-gradient(90deg, var(--c-violet), var(--g3))",
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted tabular-nums">
          {p.intoLevel}/{p.perLevel} XP · Lv.{p.level + 1}まであと{p.toNext}
        </p>
      </div>
    </div>
  );
}
