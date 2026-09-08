import { cn } from "@/lib/cn";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral:
    "border border-primary/20 bg-[color-mix(in_srgb,var(--primary)_9%,var(--card))] text-primary",
  primary:
    "border border-transparent bg-[linear-gradient(135deg,var(--g1),var(--g2))] text-white shadow-[0_4px_12px_-6px_color-mix(in_srgb,var(--accent)_70%,transparent)]",
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
