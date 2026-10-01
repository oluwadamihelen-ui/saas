import * as React from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface", className)} {...p} />;
}
export function CardHeader({ title, hint, action }: { title: React.ReactNode; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">{title}{hint && <Hint text={hint} />}</h3>
      {action}
    </div>
  );
}

const btn = {
  primary: "bg-accent text-white hover:bg-blue-500 disabled:opacity-50",
  secondary: "border border-line bg-surface-2 text-fg hover:border-muted/60",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-down-soft text-down hover:bg-down/25",
} as const;
export function buttonClass(variant: keyof typeof btn = "primary", size: "sm" | "md" | "lg" = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed",
    size === "sm" ? "h-8 px-3 text-xs" : size === "lg" ? "h-12 px-6 text-base" : "h-10 px-4 text-sm",
    btn[variant],
    extra,
  );
}
export function Button({ variant = "primary", size = "md", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof btn; size?: "sm" | "md" | "lg" }) {
  return <button className={buttonClass(variant, size, className)} {...p} />;
}
export function LinkButton({ href, variant = "primary", size = "md", className, children }: { href: string; variant?: keyof typeof btn; size?: "sm" | "md" | "lg"; className?: string; children: React.ReactNode }) {
  return <Link href={href} className={buttonClass(variant, size, className)}>{children}</Link>;
}

const field = "w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(field, "h-11 md:h-10", className)} {...p} />;
});
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={cn(field, "h-11 md:h-10", className)} {...p} />;
});
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(field, "min-h-20 py-2", className)} {...p} />;
});

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">{label}{hint && <Hint text={hint} />}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-down">{error}</span>}
    </label>
  );
}

/** Tooltip for technical terms. Works on hover and keyboard focus (and tap on mobile). */
export function Hint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button type="button" tabIndex={0} aria-label={text} className="text-muted/70 hover:text-fg focus:text-fg focus:outline-none"><Info size={13} /></button>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-line bg-surface-2 p-2.5 text-xs font-normal leading-relaxed text-fg shadow-xl group-hover:block group-focus-within:block">{text}</span>
    </span>
  );
}

const tones = {
  neutral: "bg-surface-2 text-muted",
  up: "bg-up-soft text-up",
  down: "bg-down-soft text-down",
  warn: "bg-warn-soft text-warn",
  accent: "bg-accent-soft text-accent",
} as const;
export type Tone = keyof typeof tones;
export function Badge({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", tones[tone], className)} {...p} />;
}

export function Stat({ label, value, sub, tone, hint }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "up" | "down" | "warn"; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{label}{hint && <Hint text={hint} />}</div>
      <div className={cn("num mt-1.5 text-2xl font-semibold", tone === "up" && "text-up", tone === "down" && "text-down", tone === "warn" && "text-warn")}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

export function Progress({ value, tone }: { value: number; tone?: "up" | "warn" | "down" }) {
  const v = Math.max(0, Math.min(100, value));
  const t = tone ?? (value >= 100 ? "down" : value >= 70 ? "warn" : "up");
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", t === "up" && "bg-up", t === "warn" && "bg-warn", t === "down" && "bg-down")} style={{ width: `${v}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Disclaimer({ compact }: { compact?: boolean }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted", !compact && "rounded-lg border border-line bg-surface/60 p-3")}>
      This tool provides calculations and record-keeping, not financial advice. Trading leveraged products involves substantial risk. Position size calculations depend on broker and instrument specifications — always verify contract specifications with your broker.
    </p>
  );
}

export function UpgradeNote({ feature }: { feature: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm">
      <span><strong>Pro feature.</strong> {feature}</span>
      <LinkButton href="/billing" size="sm">See Pro</LinkButton>
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-bold text-white">R</span>
      RiskPilot
    </span>
  );
}
