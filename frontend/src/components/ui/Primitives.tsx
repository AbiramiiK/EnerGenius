import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("bg-surface rounded-xl border border-sage shadow-[0_1px_3px_rgba(23,33,29,0.06)] p-5", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4 gap-3">
      <div>
        <h3 className="text-base font-semibold text-text-primary tracking-tight">{title}</h3>
        {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const tones: Record<string, string> = {
    neutral: "bg-sage/60 text-text-secondary border border-sage",
    success: "bg-emerald/10 text-emerald border border-emerald/30",
    warning: "bg-warning/10 text-warning border border-warning/30",
    danger: "bg-danger/10 text-danger border border-danger/30",
    info: "bg-grid/10 text-grid border border-grid/30",
  };
  return (
    <span className={clsx("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function Button({
  children, onClick, variant = "primary", disabled, type = "button", className, size = "md",
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean; type?: "button" | "submit"; className?: string; size?: "sm" | "md";
}) {
  const variants: Record<string, string> = {
    primary: "bg-emerald text-white hover:bg-emerald-dark disabled:bg-emerald/30 disabled:text-text-secondary shadow-[0_1px_2px_rgba(16,185,129,0.3)]",
    secondary: "bg-sage/70 text-text-primary hover:bg-sage disabled:opacity-50 border border-sage",
    ghost: "bg-transparent text-text-secondary hover:text-text-primary hover:bg-sage/40 disabled:opacity-50",
    danger: "bg-danger text-white hover:opacity-90 disabled:opacity-50",
  };
  const sizes: Record<string, string> = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2.5 text-sm" };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "rounded-lg font-semibold transition-colors disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald/50",
        variants[variant], sizes[size], className
      )}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx("animate-spin rounded-full border-2 border-sage border-t-emerald", className)} style={{ width: 20, height: 20 }} />
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <h4 className="font-semibold text-text-primary">{title}</h4>
      {description && <p className="text-sm text-text-secondary mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function KpiCard({
  label, value, unit, tone = "neutral", icon,
}: { label: string; value: string; unit?: string; tone?: "neutral" | "success" | "warning" | "danger"; icon?: ReactNode }) {
  const toneColor: Record<string, string> = {
    neutral: "text-text-primary",
    success: "text-emerald",
    warning: "text-warning",
    danger: "text-danger",
  };
  return (
    <Card className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-text-secondary font-semibold">{label}</span>
        {icon}
      </div>
      <div className={clsx("text-2xl font-bold tabular-nums", toneColor[tone])}>
        {value}
        {unit && <span className="text-sm font-medium text-text-secondary ml-1">{unit}</span>}
      </div>
    </Card>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-text-primary mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-text-secondary mt-1">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-sage bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald";
