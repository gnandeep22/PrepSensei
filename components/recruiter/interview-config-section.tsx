"use client"

import { useEffect, useState } from "react"
import {
  Clock,
  ShieldCheck,
  AlertTriangle,
  Lock,
  RefreshCw,
  Cpu,
  Info,
  CheckCircle2,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { CapacityStatusReport } from "@/lib/interview/capacity-service"

const DURATION_PRESETS = [5, 10, 15, 20, 25, 30, 45, 60]

export interface InterviewConfigSectionProps {
  durationMinutes: number
  onChange: (duration: number) => void
  disabled?: boolean
}

export function InterviewConfigSection({
  durationMinutes,
  onChange,
  disabled = false,
}: InterviewConfigSectionProps) {
  const [report, setReport] = useState<CapacityStatusReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedExceedsWarning, setSelectedExceedsWarning] = useState<string | null>(null)

  const fetchCapacity = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/interview/capacity")
      if (!res.ok) {
        throw new Error("Unable to fetch live Gemini API capacity.")
      }
      const data: CapacityStatusReport = await res.json()
      setReport(data)

      // If current duration exceeds new max safe duration, auto-adjust and warn
      if (durationMinutes > data.maxSafeDurationMinutes) {
        onChange(data.maxSafeDurationMinutes)
        setSelectedExceedsWarning(
          `Previous duration (${durationMinutes}m) exceeded current safe capacity. Auto-adjusted to ${data.maxSafeDurationMinutes} minutes.`
        )
      } else {
        setSelectedExceedsWarning(null)
      }
    } catch (err: any) {
      console.warn("Capacity fetch failed:", err)
      setError(err.message || "Failed to fetch live Gemini capacity.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchCapacity()
  }, [])

  const maxSafe = report?.maxSafeDurationMinutes ?? 20
  const configuredModel = report?.configuredModel ?? "gemini-3.5-flash-lite"
  const activeInterviews = report?.activeInterviewsCount ?? 0

  const handleSelect = (duration: number) => {
    if (disabled) return
    if (duration > maxSafe) {
      const match = report?.durationEvaluations?.find((e) => e.durationMinutes === duration)
      setSelectedExceedsWarning(
        match?.disqualificationReason ||
          `Selected duration of ${duration} minutes exceeds available Gemini API capacity (maximum currently allowed: ${maxSafe} minutes).`
      )
      return
    }
    setSelectedExceedsWarning(null)
    onChange(duration)
  }

  // Find consumption details for currently selected duration
  const currentEval = report?.durationEvaluations?.find((e) => e.durationMinutes === durationMinutes)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-muted/20 p-4 transition-all duration-200">
      {/* Section Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clock className="size-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Interview Configuration</h4>
            <p className="text-xs text-muted-foreground">
              Configure candidate interview duration with dynamic Gemini API quota protection.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 text-[11px] font-medium">
            Interview Mode: Time-Based
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fetchCapacity}
            disabled={loading || disabled}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="Refresh live Gemini capacity"
          >
            <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh Quota</span>
          </Button>
        </div>
      </div>

      {/* Duration Selection Buttons (5-minute increments) */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-foreground">
            Interview Duration:
          </Label>
          <span className="text-[11px] font-medium text-primary">
            Selected: {durationMinutes} minutes
          </span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {DURATION_PRESETS.map((dur) => {
            const isAllowed = dur <= maxSafe
            const isSelected = durationMinutes === dur

            return (
              <button
                key={dur}
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(dur)}
                aria-pressed={isSelected}
                className={`group relative flex flex-col items-center justify-center rounded-lg border py-2 px-1.5 text-xs transition-all duration-150 ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                    : isAllowed
                      ? "border-border/80 bg-background/60 hover:bg-muted hover:border-primary/50 text-foreground"
                      : "border-border/40 bg-muted/40 text-muted-foreground/60 cursor-not-allowed opacity-60"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>{dur} min</span>
                  {!isAllowed && <Lock className="size-2.5 opacity-70" />}
                </div>
                {!isAllowed && (
                  <span className="text-[9px] text-destructive/80 font-normal scale-90 sm:scale-100">
                    Quota limit
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Available Maximum Duration & Dynamic Capacity Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-lg border border-border/80 bg-background/50 px-3.5 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
          </div>
          <div>
            <span className="font-semibold text-foreground">
              Available maximum duration: {maxSafe} minutes
            </span>
            <span className="text-muted-foreground ml-1.5">
              (calibrated for {configuredModel})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="size-3 text-primary" />
            <span>Active Interviews: {activeInterviews}</span>
          </div>
          {report?.quotas && (
            <div className="hidden md:flex items-center gap-1">
              <Cpu className="size-3 text-muted-foreground" />
              <span>Safety Reserve: {report.quotas.safetyMarginPercent}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Warning banner when selected duration exceeds available capacity */}
      {selectedExceedsWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive animate-in fade-in slide-in-from-top-1">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Selected duration exceeds available Gemini capacity</p>
            <p className="text-[11px] opacity-90 mt-0.5">{selectedExceedsWarning}</p>
          </div>
        </div>
      )}

      {/* Selected duration estimated consumption breakdown */}
      {currentEval && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Info className="size-3 text-primary" />
            <span>Pacing: ~{currentEval.expectedQuestions} questions</span>
          </span>
          <span>•</span>
          <span>Reqs: ~{currentEval.expectedRequests} Gemini calls</span>
          <span>•</span>
          <span>Tokens: ~{currentEval.estimatedTotalTokens.toLocaleString()} tokens</span>
          <span>•</span>
          <span>Peak Rate: ~{currentEval.peakRpmPerCandidate} RPM</span>
        </div>
      )}
    </div>
  )
}
