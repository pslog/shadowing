import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  className,
  barClassName,
}: {
  value: number; // 0..100
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "bar-track h-2.5 w-full",
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("bar-fill", barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
