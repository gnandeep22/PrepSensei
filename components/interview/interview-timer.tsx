"use client"

import { useEffect, useRef, useState } from "react"
import { Clock, AlertTriangle, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface InterviewTimerProps {
  initialSeconds: number
  expiresAt?: string | Date | null
  onExpire: () => void
  disabled?: boolean
  className?: string
}

export function InterviewTimer({
  initialSeconds,
  expiresAt,
  onExpire,
  disabled = false,
  className = "",
}: InterviewTimerProps) {
  // Compute remaining seconds from server authoritative timestamp if provided
  const calculateRemaining = (): number => {
    if (expiresAt) {
      const expMs = new Date(expiresAt).getTime()
      const nowMs = Date.now()
      return Math.max(0, Math.floor((expMs - nowMs) / 1000))
    }
    return Math.max(0, initialSeconds)
  }

  const [secondsLeft, setSecondsLeft] = useState<number>(calculateRemaining)
  const warned5MinRef = useRef(false)
  const warned1MinRef = useRef(false)
  const expiredHandledRef = useRef(false)

  // Sync with expiresAt or initialSeconds changes
  useEffect(() => {
    setSecondsLeft(calculateRemaining())
  }, [expiresAt, initialSeconds])

  // 1-second countdown ticker
  useEffect(() => {
    if (disabled) return

    const timer = setInterval(() => {
      const remaining = calculateRemaining()
      setSecondsLeft(remaining)

      // 5-minute warning
      if (remaining <= 300 && remaining > 60 && !warned5MinRef.current) {
        warned5MinRef.current = true
      }

      // 1-minute warning
      if (remaining <= 60 && remaining > 0 && !warned1MinRef.current) {
        warned1MinRef.current = true
      }

      // Time expired trigger
      if (remaining <= 0 && !expiredHandledRef.current) {
        expiredHandledRef.current = true
        clearInterval(timer)
        onExpire()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [disabled, expiresAt, onExpire])

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const formattedTime = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`

  // Style states: normal (> 5m), warning (<= 5m), critical (<= 1m), expired (0m)
  const isExpired = secondsLeft <= 0
  const isCritical = secondsLeft <= 60 && !isExpired
  const isWarning = secondsLeft <= 300 && secondsLeft > 60

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-mono font-semibold transition-colors duration-300 ${
          isExpired
            ? "border-destructive/60 bg-destructive/15 text-destructive animate-pulse"
            : isCritical
              ? "border-rose-500/60 bg-rose-500/15 text-rose-600 dark:text-rose-400 animate-pulse shadow-xs"
              : isWarning
                ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-primary/30 bg-primary/10 text-primary"
        }`}
        title={
          expiresAt
            ? `Server Authoritative Expiry: ${new Date(expiresAt).toLocaleTimeString()}`
            : "Interview Duration Timer"
        }
      >
        <Clock className={`size-3.5 ${isCritical ? "animate-spin" : ""}`} />
        <span>{isExpired ? "00:00" : formattedTime}</span>
        {isCritical && <span className="text-[10px] uppercase font-bold tracking-wider ml-0.5">Final Min</span>}
      </div>

      {/* Subtle status notice banner */}
      {isCritical && !isExpired && (
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-rose-500 animate-in fade-in">
          <AlertTriangle className="size-3" /> Wrap up and submit
        </span>
      )}
      {isWarning && !isCritical && (
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
          <span>5m remaining</span>
        </span>
      )}
      {isExpired && (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive">
          <ShieldAlert className="size-3" /> Time Expired
        </span>
      )}
    </div>
  )
}
