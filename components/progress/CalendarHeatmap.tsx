import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { DayStat } from "@/lib/store/selectors";

const WEEK_JP = ["日", "月", "火", "水", "木", "金", "土"];

function encourage(
  currentStreak: number,
  longestStreak: number,
  activeToday: boolean,
): string {
  if (currentStreak === 0) return "今日から始めよう。まず1日、1文でもOK。";
  if (activeToday && currentStreak >= longestStreak)
    return "自己ベスト更新中！この調子で続けよう。";
  if (activeToday) return "今日も達成！連続記録を伸ばそう。";
  return `連続${currentStreak}日。今日やれば記録がつながります。`;
}

/** Lịch tuần (7 ngày gần nhất) nhấn mạnh streak để tạo động lực mỗi ngày. */
export function CalendarHeatmap({
  stats,
  currentStreak,
  longestStreak,
}: {
  stats: DayStat[];
  currentStreak: number;
  longestStreak: number;
}) {
  const week = stats.slice(-7);
  const activeToday = (stats[stats.length - 1]?.count ?? 0) > 0;
  const total = stats.reduce((s, d) => s + d.count, 0);
  const hasStreak = currentStreak > 0;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>練習履歴</CardTitle>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold",
            hasStreak
              ? "bg-[var(--warning-soft)] text-[var(--warning)]"
              : "bg-surface text-muted",
          )}
        >
          <Icon name="flame" size={15} filled={hasStreak} />
          {currentStreak}日連続
        </span>
      </div>

      <p className="mt-2 text-sm font-semibold text-muted">
        {encourage(currentStreak, longestStreak, activeToday)}
      </p>

      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {week.map((d, i) => {
          const active = d.count > 0;
          const isToday = i === week.length - 1;
          const dow = WEEK_JP[new Date(d.date).getDay()];
          const dayNum = Number(d.date.slice(8, 10));
          return (
            <div key={d.date} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "text-[11px] font-bold",
                  isToday ? "text-[var(--warning)]" : "text-muted",
                )}
              >
                {dow}
              </span>
              <div
                title={`${d.date}: ${d.count}文Pass`}
                className={cn(
                  "grid h-9 w-full place-items-center rounded-lg text-xs font-extrabold tabular-nums transition-colors",
                  active
                    ? "bg-[var(--c-amber)] text-white shadow-[var(--shadow-sm)]"
                    : "border border-border bg-surface text-muted/60",
                  isToday &&
                    "outline outline-2 -outline-offset-2 outline-[var(--warning)]",
                )}
              >
                {active ? <Icon name="flame" size={15} filled /> : dayNum}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="flex items-center gap-1.5 font-bold text-fg">
          <Icon name="trophy" size={14} className="text-[var(--warning)]" />
          最長 {longestStreak}日
        </span>
        <span className="font-semibold text-muted">
          この30日で {total.toLocaleString("ja-JP")}文Pass
        </span>
      </div>
    </Card>
  );
}
