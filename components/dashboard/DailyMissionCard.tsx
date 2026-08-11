"use client";

import { useI18n } from "@/components/i18n/useI18n";
import { CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

export function DailyMissionCard({
  passed,
  target,
  completed,
}: {
  passed: number;
  target: number;
  completed: boolean;
}) {
  const { dictionary: m } = useI18n();
  const copy = m.mission;
  const done = Math.min(passed, target);

  return (
    <div className="tile p-5" style={{ ["--tile-c" as string]: "var(--c-emerald)" }}>
      <div className="flex items-start justify-between">
        <CardTitle>{copy.title}</CardTitle>
        <span className="tile-icon h-11 w-11">
          <Icon name="target" size={22} />
        </span>
      </div>

      <p className="mt-3 text-lg font-bold">
        {completed ? (
          <span className="flex items-center gap-1.5 text-[var(--success)]">
            <Icon name="check" size={18} strokeWidth={2.5} />
            {copy.completed}
          </span>
        ) : (
          <span className="text-[var(--c-emerald)]">{copy.target(target)}</span>
        )}
      </p>

      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: target }).map((_, i) => (
          <span
            key={i}
            className="h-2.5 flex-1 rounded-full transition-colors"
            style={{
              background:
                i < done
                  ? "var(--c-emerald)"
                  : "color-mix(in srgb, var(--muted) 22%, transparent)",
            }}
          />
        ))}
      </div>
      <p className="mt-2 text-sm text-muted tabular-nums">
        {copy.progress(done, target)}
        {!completed && passed > 0 && copy.left(target - passed)}
      </p>
    </div>
  );
}
