"use client";

import { useI18n } from "@/components/i18n/useI18n";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { dayOfWeek } from "@/lib/date";
import type { Dictionary } from "@/lib/i18n";
import type { DayStat } from "@/lib/store/selectors";

function encourage(
  t: Dictionary["heatmap"],
  currentStreak: number,
  longestStreak: number,
  activeToday: boolean,
): string {
  if (currentStreak === 0) return t.encourageStart;
  if (activeToday && currentStreak >= longestStreak) return t.encourageBest;
  if (activeToday) return t.encourageToday;
  return t.encourageResume(currentStreak);
}

/**
 * Practice calendar over the whole window it is given, laid out by weekday.
 *
 * It used to render `stats.slice(-7)` even though the caller passes 30 days,
 * which made it a second drawing of the same seven days the dashboard's week
 * chart already showed. Now it uses the full window, so the two pages answer
 * different questions: the dashboard shows this week's rhythm, this shows the
 * month.
 */
export function CalendarHeatmap({
  stats,
  currentStreak,
  longestStreak,
}: {
  stats: DayStat[];
  currentStreak: number;
  longestStreak: number;
}) {
  const { localeTag, dictionary } = useI18n();
  const t = dictionary.heatmap;
  const activeToday = (stats[stats.length - 1]?.count ?? 0) > 0;
  const todayDate = stats[stats.length - 1]?.date;
  // Blank cells so the first day lands under its own weekday column.
  const lead = stats.length > 0 ? dayOfWeek(stats[0].date) : 0;
  const total = stats.reduce((s, d) => s + d.count, 0);
  const hasStreak = currentStreak > 0;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t.title}</CardTitle>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold",
            hasStreak
              ? "bg-[var(--warning-soft)] text-[var(--warning)]"
              : "bg-surface text-muted",
          )}
        >
          <Icon name="flame" size={15} filled={hasStreak} />
          {currentStreak}
          {t.streakSuffix}
        </span>
      </div>

      <p className="mt-2 text-sm font-semibold text-muted">
        {encourage(t, currentStreak, longestStreak, activeToday)}
      </p>

      <div className="mt-4 grid grid-cols-7 gap-1.5" aria-hidden>
        {dictionary.weekdays.map((dow) => (
          <span key={dow} className="text-center text-[11px] font-bold text-muted">
            {dow}
          </span>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }).map((_, i) => (
          <span key={`lead-${i}`} aria-hidden />
        ))}
        {stats.map((d) => {
          const active = d.count > 0;
          const isToday = d.date === todayDate;
          const dayNum = Number(d.date.slice(8, 10));
          return (
            <div
              key={d.date}
              title={t.dayTooltip(d.date, d.count)}
              className={cn(
                "grid h-8 w-full place-items-center rounded-lg text-[11px] font-extrabold tabular-nums transition-colors",
                active
                  ? "bg-[var(--c-amber)] text-white shadow-[var(--shadow-sm)]"
                  : "border border-border bg-surface text-muted/60",
                isToday &&
                  "outline outline-2 -outline-offset-2 outline-[var(--warning)]",
              )}
            >
              {active ? <Icon name="flame" size={13} filled /> : dayNum}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="flex items-center gap-1.5 font-bold text-fg">
          <Icon name="trophy" size={14} className="text-[var(--warning)]" />
          {t.longest(longestStreak)}
        </span>
        <span className="font-semibold text-muted">
          {t.last30(total.toLocaleString(localeTag))}
        </span>
      </div>
    </Card>
  );
}
