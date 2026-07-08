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
  return (
    <div className="tile p-5" style={{ ["--tile-c" as string]: "var(--c-amber)" }}>
      <div className="flex items-start justify-between">
        <CardTitle>ストリーク</CardTitle>
        <span className="tile-icon h-11 w-11">
          <Icon name="flame" size={22} filled />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-4xl font-extrabold tabular-nums text-[var(--c-amber)]">
          {current}
        </span>
        <span className="text-muted">日</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {keptToday
          ? "今日のストリークは達成済みです！"
          : current > 0
            ? "今日5文Passしてストリークを続けましょう。"
            : "今日5文Passしてストリークを始めましょう。"}
      </p>
      <p className="mt-1 text-xs text-muted">最高記録: {longest}日</p>
    </div>
  );
}
