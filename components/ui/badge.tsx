import { cn } from "@/lib/cn";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface text-muted border border-border",
  primary: "bg-primary/10 text-primary border border-primary/20",
  success:
    "bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success)]/25",
  warning:
    "bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning)]/25",
  danger: "bg-danger/10 text-danger border border-danger/20",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
