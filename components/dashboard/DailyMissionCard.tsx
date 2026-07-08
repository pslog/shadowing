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
  const done = Math.min(passed, target);
  return (
    <div
      className="tile p-5"
      style={{ ["--tile-c" as string]: "var(--c-emerald)" }}
    >
      <div className="flex items-start justify-between">
        <CardTitle>今日のミッション</CardTitle>
        <span className="tile-icon h-11 w-11">
          <Icon name="target" size={22} />
        </span>
      </div>

      <p className="mt-3 text-lg font-bold">
        {completed ? (
          <span className="flex items-center gap-1.5 text-[var(--success)]">
            <Icon name="check" size={18} strokeWidth={2.5} />
            完了！
          </span>
        ) : (
          <>
            <span className="text-[var(--c-emerald)]">{target}</span>文をPass
          </>
        )}
      </p>

      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: target }).map((_, i) => (
          <span
            key={i}
            className="h-2.5 flex-1 rounded-full transition-colors"
            style={{
              background:
                i < done ? "var(--c-emerald)" : "color-mix(in srgb, var(--muted) 22%, transparent)",
            }}
          />
        ))}
      </div>
      <p className="mt-2 text-sm text-muted tabular-nums">
        {done}/{target}文
        {!completed && passed > 0 && ` · あと${target - passed}文`}
      </p>
    </div>
  );
}
