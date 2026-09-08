import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-bold transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out focus-ring disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-[var(--shadow-accent)] hover:bg-[var(--accent-hover)]",
  secondary:
    "border border-primary/25 bg-primary/10 text-primary shadow-sm hover:border-primary/40 hover:bg-primary/15",
  outline: "border border-border text-fg hover:bg-surface hover:border-primary/40",
  ghost: "text-fg hover:bg-surface",
  danger: "bg-danger text-white shadow-sm hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-11 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-11 w-11 px-0",
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
