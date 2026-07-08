import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-ring disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.97]";

const variants: Record<Variant, string> = {
  primary:
    "shine brand-gradient text-white shadow-[var(--shadow-glow)] hover:brightness-110 hover:-translate-y-0.5",
  secondary:
    "bg-surface text-fg border border-border hover:border-primary/40 hover:bg-card",
  outline: "border border-border text-fg hover:bg-surface hover:border-primary/40",
  ghost: "text-fg hover:bg-surface",
  danger: "bg-danger text-white shadow-sm hover:brightness-110 hover:-translate-y-0.5",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10",
};

export function buttonClasses(
  variant: Variant = "primary",
  size: Size = "md",
  extra?: string,
): string {
  return cn(base, variants[variant], sizes[size], extra);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}
