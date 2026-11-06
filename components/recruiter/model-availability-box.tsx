"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Cpu, Sparkles, RefreshCw, Zap, Clock, AlertTriangle, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ModelStatusRecord } from "@/lib/ai/gemini-race"
import { GEMINI_RACING_MODELS } from "@/lib/ai/gemini-race"

interface ModelAvailabilityBoxProps {
  className?: string
  initialOpen?: boolean
  winningModel?: string | null
  winningModelLabel?: string | null
  raceDurationMs?: number | null
}

const STORAGE_KEY = "prepsensei_gemini_models_open"

export function ModelAvailabilityBox({
  className,
  initialOpen = false,
  winningModel,
  winningModelLabel,
  raceDurationMs,
}: ModelAvailabilityBoxProps) {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved !== null) return saved === "true"
    }
    return initialOpen
  })

  const [models, setModels] = useState<ModelStatusRecord[]>(() => {
    return GEMINI_RACING_MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      category: m.category,
      status: "available",
      statusLabel: "Available",
      isZeroQuota: false,
      retryAfter: null,
      retryDelaySec: null,
      remainingSec: null,
      reason: null,
      lastChecked: Date.now(),
    }))
  })

  const [loading, setLoading] = useState(false)

  // Fetch model statuses from server
  async function fetchStatuses() {
    try {
      setLoading(true)
      const res = await fetch("/api/recruiter/models")
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.statuses)) {
          setModels(data.statuses)
        }
      }
    } catch (e) {
      console.warn("[ModelAvailabilityBox] fetch error:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatuses()
  }, [])

  // Second-by-second countdown timer for rate-limited models
  useEffect(() => {
    const hasActiveCooldown = models.some((m) => m.remainingSec && m.remainingSec > 0)
    if (!hasActiveCooldown) return

    const timer = setInterval(() => {
      setModels((prev) =>
        prev.map((m) => {
          if (!m.retryAfter) return m
          const diff = Math.ceil((m.retryAfter - Date.now()) / 1000)
          if (diff <= 0) {
            return {
              ...m,
              status: "available",
              statusLabel: "Available",
              retryAfter: null,
              retryDelaySec: null,
              remainingSec: null,
              reason: null,
            }
          }
          return {
            ...m,
            remainingSec: diff,
          }
        })
      )
    }, 1000)

    return () => clearInterval(timer)
  }, [models])

  const availableCount = models.filter((m) => m.status === "available").length
  const totalCount = models.length

  function toggleOpen() {
    setIsOpen((prev) => {
      const next = !prev
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY, String(next))
      }
      return next
    })
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md transition-all duration-200 overflow-hidden text-xs shadow-xs",
        isOpen ? "border-primary/40 bg-card/80 shadow-md" : "hover:border-border",
        className
      )}
    >
      {/* Collapsible Header Button */}
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left cursor-pointer transition-colors hover:bg-primary/5 select-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Cpu className="size-3.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[11px] tracking-wider uppercase text-foreground">
              AI Race Model Availability
            </span>
            <ChevronDown
              className={cn("size-3.5 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {winningModel && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-500 dark:text-amber-400 font-medium">
              <Zap className="size-3" />
              <span>
                Won by <strong>{winningModelLabel || winningModel}</strong>
                {raceDurationMs ? ` in ${(raceDurationMs / 1000).toFixed(1)}s` : ""}
              </span>
            </span>
          )}

          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-bold border transition-colors",
              availableCount > 0
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            )}
          >
            {availableCount} of {totalCount} available
          </span>
        </div>
      </button>

      {/* Expanded Details Body */}
      {isOpen && (
        <div className="border-t border-border/60 p-3.5 bg-background/40 flex flex-col gap-2.5 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              All available Gemini LLMs race simultaneously. The fastest response is selected automatically.
            </span>
            <button
              type="button"
              onClick={fetchStatuses}
              disabled={loading}
              className="inline-flex items-center gap-1 text-primary hover:underline font-medium cursor-pointer"
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {models.map((m) => {
              const isAvail = m.status === "available"
              const isLimited = m.status === "rate_limited" || m.status === "daily_limited"
              const isBlocked = m.isZeroQuota || m.status === "unsupported" || m.status === "billing_restricted"

              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors",
                    isAvail
                      ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40"
                      : isLimited
                      ? "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40"
                      : "border-border/40 bg-muted/20 opacity-70"
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        isAvail
                          ? "bg-emerald-500 animate-pulse"
                          : isLimited
                          ? "bg-amber-500 animate-ping"
                          : "bg-muted-foreground"
                      )}
                    />
                    <span className="font-semibold text-[11px] text-foreground truncate">{m.label}</span>
                  </div>

                  <div className="shrink-0">
                    {isAvail ? (
                      <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Available
                      </span>
                    ) : isLimited ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        <Clock className="size-2.5" />
                        {m.remainingSec ? `${m.remainingSec}s cooldown` : "Rate limited"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] text-muted-foreground">
                        {m.statusLabel}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {availableCount === 0 && (
            <div className="mt-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                All AI models are currently rate-limited. The system will use deterministic RAG shortlisting until cooldown expires.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
