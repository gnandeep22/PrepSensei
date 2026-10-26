import type { ReactNode } from "react"
import { ArrowDown, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

export function PageHeader({
  title,
  description,
  actions,
}: {
    title: ReactNode
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-1">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-foreground text-balance sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  progress,
  badge,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
  progress?: number
  badge?: string
}) {
  return (
    <div className="group rounded-2xl border border-border/70 bg-card p-5 sm:p-5.5 shadow-xs transition-all duration-200 hover:border-border hover:shadow-sm flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </p>
        {badge ? (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border border-primary/20 bg-primary/10 text-primary">
            {badge}
          </span>
        ) : icon ? (
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-primary transition-colors">
            {icon}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-none">
          {value}
        </div>
        {hint && (
          <p className="text-xs text-muted-foreground truncate">
            {hint}
          </p>
        )}
      </div>

      {typeof progress === "number" && (
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mt-0.5">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function scoreTone(score: number) {
  if (score >= 75) return { text: "text-success", bg: "bg-success", ring: "border-success" }
  if (score >= 55) return { text: "text-warning", bg: "bg-warning", ring: "border-warning" }
  return { text: "text-destructive", bg: "bg-destructive", ring: "border-destructive" }
}

export function MatchScore({
  score,
  size = "md",
  label = "match",
}: {
  score: number
  size?: "sm" | "md" | "lg"
  label?: string
}) {
  const tone = scoreTone(score)
  const dims = size === "lg" ? "size-32 text-4xl" : size === "md" ? "size-20 text-xl" : "size-12 text-sm"
  const radius = size === "lg" ? 58 : size === "md" ? 36 : 21
  const stroke = size === "lg" ? 8 : size === "md" ? 6 : 4
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  const box = radius * 2 + stroke * 2

  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center", dims)}
      role="img"
      aria-label={`${score}% ${label}`}
    >
      <svg viewBox={`0 0 ${box} ${box}`} className="absolute inset-0 -rotate-90">
        <circle cx={box / 2} cy={box / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-700", tone.text)}
          stroke="currentColor"
        />
      </svg>
      <div className="flex flex-col items-center leading-none">
        <span className={cn("font-semibold tabular-nums", tone.text)}>{score}%</span>
        {size !== "sm" && <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>}
      </div>
    </div>
  )
}

export function SkillBar({
  label,
  value,
  meta,
  tone,
}: {
  label: string
  value: number
  meta?: ReactNode
  tone?: "success" | "warning" | "destructive" | "primary"
}) {
  const color =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : tone === "destructive"
          ? "bg-destructive"
          : "bg-primary"
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="flex items-center gap-2 text-muted-foreground">{meta ?? `${value}%`}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

/** Vertical or horizontal flow diagram: A → B → C */
export function Pipeline({
  steps,
  orientation = "horizontal",
  activeIndex,
}: {
  steps: { label: string; description?: string }[]
  orientation?: "horizontal" | "vertical"
  activeIndex?: number
}) {
  const horizontal = orientation === "horizontal"
  return (
    <ol className={cn("flex items-stretch gap-2", horizontal ? "flex-col sm:flex-row sm:items-center" : "flex-col items-center")}>
      {steps.map((step, i) => {
        const active = activeIndex === undefined || i <= activeIndex
        return (
          <li key={step.label} className={cn("flex items-center gap-2", horizontal ? "flex-col sm:flex-row sm:flex-1" : "flex-col")}>
            <div
              className={cn(
                "flex w-full flex-col items-center rounded-md border px-3 py-2.5 text-center",
                horizontal ? "sm:flex-1" : "min-w-44",
                active ? "border-primary bg-primary/5" : "border-border bg-card",
              )}
            >
              <span className={cn("text-sm font-semibold", active ? "text-primary" : "text-foreground")}>{step.label}</span>
              {step.description && <span className="mt-0.5 text-xs text-muted-foreground text-pretty">{step.description}</span>}
            </div>
            {i < steps.length - 1 && (
              <span className="text-muted-foreground" aria-hidden="true">
                {horizontal ? (
                  <>
                    <ArrowDown className="size-4 sm:hidden" />
                    <ArrowRight className="hidden size-4 sm:block" />
                  </>
                ) : (
                  <ArrowDown className="size-4" />
                )}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return (
    <div
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        tone === "warning" ? "border-warning/40 bg-warning/10 text-foreground" : "border-primary/30 bg-primary/5 text-foreground",
      )}
    >
      {children}
    </div>
  )
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

export const nativeSelectClass =
  "h-8 w-full rounded-lg border border-input bg-card text-foreground px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-card [&>option]:text-foreground [&>optgroup]:bg-card [&>optgroup]:text-foreground dark:[&>option]:bg-zinc-900 dark:[&>option]:text-zinc-100 dark:[&>optgroup]:bg-zinc-900 dark:[&>optgroup]:text-zinc-100 [color-scheme:light] dark:[color-scheme:dark]"
