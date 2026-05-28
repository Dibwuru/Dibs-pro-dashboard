import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

const variantStyles = {
  primary:
    "btn-gradient text-white shadow-lg shadow-primary/20 hover:shadow-primary/30",
  secondary:
    "bg-secondary/15 text-secondary border border-secondary/20 hover:bg-secondary/20 hover:border-secondary/30",
  outline:
    "border border-slate-300 dark:border-slate-700 text-slate-950 dark:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:border-slate-400 dark:hover:border-white/20",
  ghost:
    "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04]",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs gap-1.5 rounded-lg",
  md: "px-5 py-2.5 text-sm gap-2 rounded-lg",
  lg: "px-6 py-3 text-base gap-2.5 rounded-xl",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}
