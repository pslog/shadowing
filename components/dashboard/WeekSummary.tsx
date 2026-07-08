import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { shortDayLabel, todayKey } from "@/lib/date";
import type { DayStat } from "@/lib/store/selectors";

export function WeekSummary({ stats }: { stats: DayStat[] }) {
  const total = stats.reduce((s, d) => s + d.count, 0);
  const max = Math.max(1, ...stats.map((d) => d.count));
  const today = todayKey();
  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-1.5">
          <Icon name="trending" size={14} />直近7日
        </CardTitle>
        <span className="text-sm text-muted">
          <b className="text-fg">{total}</b>文Pass
        </span>
      </div>
      <div className="mt-5 flex h-28 items-end justify-between gap-2.5">
        {stats.map((d) => {
          const isToday = d.date === today;
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-lg transition-all duration-500"
                  style={{
                    height: `${(d.count / max) * 100}%`,
                    minHeight: d.count > 0 ? "10px" : "4px",
                    background: d.count
                      ? "linear-gradient(180deg, var(--g3), var(--g1))"
                      : "color-mix(in srgb, var(--muted) 20%, transparent)",
                    boxShadow: d.count
                      ? "0 6px 16px -8px color-mix(in srgb, var(--g2) 90%, transparent)"
                      : "none",
                  }}
                  title={`${d.count}文`}
                />
              </div>
              <span
                className={
                  isToday
                    ? "text-[11px] font-bold text-[var(--primary)]"
                    : "text-[11px] text-muted"
                }
              >
                {shortDayLabel(d.date)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
