import { Card, CardTitle } from "@/components/ui/card";
import type { DayStat } from "@/lib/store/selectors";

function levelClass(count: number): string {
  if (count === 0) return "bg-border/50";
  if (count < 3) return "bg-primary/30";
  if (count < 6) return "bg-primary/60";
  return "bg-primary";
}

/** GitHub-style heatmap of sentences passed per day (last N days). */
export function CalendarHeatmap({ stats }: { stats: DayStat[] }) {
  return (
    <Card>
      <CardTitle>練習履歴</CardTitle>
      <div className="mt-4 grid grid-flow-col grid-rows-7 gap-1">
        {stats.map((d) => (
          <div
            key={d.date}
            className={`h-3.5 w-3.5 rounded-[3px] ${levelClass(d.count)}`}
            title={`${d.date}: ${d.count}文`}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span>少ない</span>
        <span className="h-3 w-3 rounded-[3px] bg-border/50" />
        <span className="h-3 w-3 rounded-[3px] bg-primary/30" />
        <span className="h-3 w-3 rounded-[3px] bg-primary/60" />
        <span className="h-3 w-3 rounded-[3px] bg-primary" />
        <span>多い</span>
      </div>
    </Card>
  );
}
