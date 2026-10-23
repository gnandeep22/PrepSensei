"use client"

import React, { useEffect, useRef, useState } from "react"
import { CheckCircle2, RefreshCw, ArrowLeft, ShieldCheck, Sparkles, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

export interface OtpVerificationCardProps {
  email: string
  name?: string
  role?: "candidate" | "recruiter"
  onVerified?: (otp: string) => Promise<void> | void
  onBack?: () => void
  onResend?: () => Promise<boolean> | boolean
  title?: string
  subtitle?: string
  embedded?: boolean
}

export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email
  const [local, domain] = email.split("@")
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`
  }
  const first = local[0]
  const last = local[local.length - 1]
  const stars = "*".repeat(Math.max(2, Math.min(4, local.length - 2)))
  return `${first}${stars}${last}@${domain}`
}

export function OtpVerificationCard({
  email,
  name,
  role = "candidate",
  onVerified,
  onBack,
  onResend,
  title = "Verify your email",
  subtitle,
  embedded = false,
}: OtpVerificationCardProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""])
  const [animationState, setAnimationState] = useState<"idle" | "curling" | "spinning" | "screwing" | "verified" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState<number>(60)
  const [resending, setResending] = useState<boolean>(false)
  const [resendSuccess, setResendSuccess] = useState<boolean>(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((c) => (c > 0 ? c - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Auto-focus first input on mount
  useEffect(() => {
    if (animationState === "idle") {
      inputRefs.current[0]?.focus()
    }
  }, [animationState])

  // Handle individual digit change
  const handleDigitChange = (index: number, value: string) => {
    const cleanValue = value.replace(/\D/g, "")
    if (!cleanValue) {
      const next = [...digits]
      next[index] = ""
      setDigits(next)
      return
    }

    // Single digit input
    const char = cleanValue.slice(-1)
    const next = [...digits]
    next[index] = char
    setDigits(next)
    setErrorMessage(null)

    // Advance focus
    if (index < 3) {
      inputRefs.current[index + 1]?.focus()
    } else {
      // 4th digit entered: Trigger the orbital verification animation!
      const fullCode = next.join("")
      if (fullCode.length === 4) {
        triggerVerification(fullCode)
      }
    }
  }

  // Handle keyboard navigation & backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault()
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < 3) {
      e.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  // Handle pasting 4-digit code
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4)
    if (!pasted) return

    const next = ["", "", "", ""]
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i]
    }
    setDigits(next)
    setErrorMessage(null)

    if (pasted.length === 4) {
      inputRefs.current[3]?.focus()
      triggerVerification(pasted)
    } else {
      inputRefs.current[Math.min(3, pasted.length)]?.focus()
    }
  }

  // Execute Reference 1's sequence:
  // 1. Curl onto orbit -> 2. Spin a turn and a quarter (450deg) -> 3. Screw down into one verified tile -> 4. Verdict
  const triggerVerification = async (code: string) => {
    // 1. Curl onto orbit
    setAnimationState("curling")

    // After brief curl (180ms), start spinning 450 degrees
    setTimeout(() => {
      setAnimationState("spinning")
    }, 180)

    // Parallel: Call real verification API
    try {
      const verifyPromise = fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          email: email.trim(),
          otp: code,
        }),
      }).then(async (res) => {
        const data = await res.json()
        return { ok: res.ok, data }
      })

      // The orbital spin takes 950ms
      const [res] = await Promise.all([
        verifyPromise,
        new Promise((resolve) => setTimeout(resolve, 950)),
      ])

      if (res.ok && res.data.verified) {
        // 3. Screw down into one verified tile
        setAnimationState("screwing")
        setTimeout(async () => {
          setAnimationState("verified")
          if (onVerified) {
            try {
              await onVerified(code)
            } catch (err: any) {
              setAnimationState("error")
              setErrorMessage(err?.message || "Failed to complete account registration. Please try again.")
              setTimeout(() => {
                setAnimationState("idle")
                setDigits(["", "", "", ""])
                inputRefs.current[0]?.focus()
              }, 1200)
            }
          }
        }, 320)
      } else {
        // Verification failed: trigger shake & reset
        setAnimationState("error")
        setErrorMessage(res.data.error || "Incorrect verification code. Please check your email.")
        setTimeout(() => {
          setAnimationState("idle")
          setDigits(["", "", "", ""])
          inputRefs.current[0]?.focus()
        }, 900)
      }
    } catch {
      setAnimationState("error")
      setErrorMessage("Network error verifying code. Please check your connection.")
      setTimeout(() => {
        setAnimationState("idle")
        inputRefs.current[0]?.focus()
      }, 900)
    }
  }

  // Handle Resend OTP
  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return
    setResending(true)
    setErrorMessage(null)

    try {
      if (onResend) {
        const success = await onResend()
        if (success) {
          setResendCooldown(60)
          setResendSuccess(true)
          setTimeout(() => setResendSuccess(false), 3500)
        }
      } else {
        const res = await fetch("/api/auth/otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send",
            email: email.trim(),
            name: name || "",
            role,
          }),
        })
        const data = await res.json()
        if (res.ok && data.success) {
          setResendCooldown(60)
          setResendSuccess(true)
          setTimeout(() => setResendSuccess(false), 3500)
        } else {
          setErrorMessage(data.error || "Failed to resend code.")
        }
      }
    } catch {
      setErrorMessage("Could not resend code. Please try again.")
    } finally {
      setResending(false)
    }
  }

  // Radius for orbital positions in px
  const ORBIT_RADIUS = 62
  const ROW_STEP = 66 // Spacing between box centers in horizontal row

  // Coordinate offsets relative to center (0, 0)
  const getBoxTransform = (index: number) => {
    if (animationState === "idle" || animationState === "error") {
      // Horizontal row: [-99px, -33px, +33px, +99px]
      const xOffset = (index - 1.5) * ROW_STEP
      return `translate(calc(-50% + ${xOffset}px), -50%) scale(1)`
    }
    if (animationState === "screwing" || animationState === "verified") {
      // Screwed down to the exact center core
      return "translate(-50%, -50%) scale(0)"
    }

    // Curling or spinning on concentric circle of radius ORBIT_RADIUS
    // Box 0: 12 o'clock (0, -R)
    // Box 1: 3 o'clock  (R, 0)
    // Box 2: 6 o'clock  (0, R)
    // Box 3: 9 o'clock  (-R, 0)
    switch (index) {
      case 0:
        return `translate(-50%, calc(-50% - ${ORBIT_RADIUS}px)) scale(0.92)`
      case 1:
        return `translate(calc(-50% + ${ORBIT_RADIUS}px), -50%) scale(0.92)`
      case 2:
        return `translate(-50%, calc(-50% + ${ORBIT_RADIUS}px)) scale(0.92)`
      case 3:
        return `translate(calc(-50% - ${ORBIT_RADIUS}px), -50%) scale(0.92)`
      default:
        return "translate(-50%, -50%)"
    }
  }

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-md overflow-hidden rounded-3xl p-6 sm:p-8 transition-all duration-300",
        "glass-apple-card specular-border",
        animationState === "error" && "animate-otp-shake border-destructive/60",
        embedded ? "shadow-none border-0 bg-transparent p-0 sm:p-0" : ""
      )}
    >
      {/* Cold light ambient radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 size-64 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-1/2 -z-10 size-64 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
      />

      {/* Header */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="relative mb-3 flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-xs">
          <ShieldCheck className="size-6 text-primary transition-transform duration-300 hover:scale-110" />
          <span className="absolute -top-1 -right-1 flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
          </span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xs text-balance">
          {subtitle || (
            <>
              Enter the 4-digit code sent to{" "}
              <strong className="font-semibold text-foreground underline decoration-primary/40 underline-offset-2">
                {maskEmail(email)}
              </strong>
            </>
          )}
        </p>
      </div>

      {/* Main Interactive Stage: Orbital Transition Container */}
      <div className="relative my-4 flex h-52 w-full items-center justify-center select-none">
        {/* Orbital Background Ring (Visible when curling / spinning) */}
        <div
          className={cn(
            "pointer-events-none absolute rounded-full border border-dashed transition-all duration-500",
            animationState === "curling" || animationState === "spinning"
              ? "border-primary/50 opacity-100 scale-100"
              : "border-transparent opacity-0 scale-75",
            animationState === "spinning" && "animate-orbit-spin"
          )}
          style={{
            width: `${ORBIT_RADIUS * 2}px`,
            height: `${ORBIT_RADIUS * 2}px`,
            willChange: "transform",
          }}
        />

        {/* Central Hub Glowing Core */}
        <div
          className={cn(
            "pointer-events-none absolute flex size-5 items-center justify-center rounded-full transition-all duration-500",
            animationState === "curling" || animationState === "spinning"
              ? "opacity-100 scale-100 bg-emerald-400/25 shadow-[0_0_20px_rgba(52,211,153,0.9)]"
              : "opacity-0 scale-50"
          )}
        >
          <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        {/* VERIFIED TILE STATE: Screws down into one verified tile */}
        <div
          className={cn(
            "absolute flex flex-col items-center justify-center transition-all duration-300",
            animationState === "verified"
              ? "opacity-100 scale-100 animate-verified-pop pointer-events-auto"
              : "opacity-0 scale-50 pointer-events-none"
          )}
        >
          <div className="flex size-20 items-center justify-center rounded-3xl border-2 border-emerald-500 bg-emerald-500/15 text-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.45)] backdrop-blur-xl">
            <CheckCircle2 className="size-10 stroke-[2.2] animate-bounce" />
          </div>
          <p className="mt-3 text-sm font-semibold tracking-wide text-emerald-500">
            Verified
          </p>
        </div>

        {/* ORBITAL TURNTABLE: Rotates in a true circle around (0,0) */}
        <div
          className={cn(
            "relative size-52 sm:size-56 flex items-center justify-center transition-transform",
            animationState === "spinning" && "animate-orbit-spin",
            animationState === "verified" && "opacity-0 pointer-events-none"
          )}
          style={{
            transformOrigin: "center center",
            willChange: "transform",
          }}
        >
          {digits.map((digit, index) => {
            const isFilled = Boolean(digit)
            const isError = animationState === "error"
            const isDisabled = animationState !== "idle" && animationState !== "error"

            return (
              <div
                key={index}
                className={cn(
                  "absolute left-1/2 top-1/2 flex size-14 items-center justify-center rounded-2xl transition-all duration-400",
                  "border border-border/70 bg-card/80 backdrop-blur-xl shadow-xs",
                  isFilled && "border-primary/60 shadow-[0_0_12px_rgba(250,79,97,0.25)] bg-card",
                  isError && "border-destructive text-destructive bg-destructive/10 shadow-[0_0_15px_rgba(239,68,68,0.35)]",
                  animationState === "curling" && "shadow-[0_0_20px_rgba(52,211,153,0.35)]",
                  animationState === "screwing" && "scale-0 opacity-0"
                )}
                style={{
                  transform: getBoxTransform(index),
                  transition: "transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease",
                  willChange: "transform, opacity",
                }}
              >
                {/* Internal counter-rotation when spinning to keep numbers readable */}
                <div
                  className={cn(
                    "flex h-full w-full items-center justify-center",
                    animationState === "spinning" && "animate-orbit-counter-spin"
                  )}
                  style={{ willChange: "transform" }}
                >
                  <input
                    ref={(el) => {
                      inputRefs.current[index] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    disabled={isDisabled}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className={cn(
                      "h-full w-full rounded-2xl bg-transparent text-center font-mono text-2xl font-bold tracking-tight text-foreground outline-hidden transition-all",
                      "focus:ring-2 focus:ring-primary/50 focus:border-primary",
                      isDisabled && "cursor-default select-none opacity-80"
                    )}
                    aria-label={`Digit ${index + 1}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Error or Success notification */}
      {errorMessage && (
        <div
          role="alert"
          className="my-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-center text-xs font-medium text-destructive animate-fade-in"
        >
          {errorMessage}
        </div>
      )}

      {resendSuccess && (
        <div
          role="status"
          className="my-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-center text-xs font-medium text-emerald-500 animate-fade-in"
        >
          A fresh 4-digit verification code has been dispatched to your email.
        </div>
      )}

      {/* Resend and Navigation Controls */}
      <div className="mt-4 flex flex-col items-center gap-3 border-t border-border/40 pt-4 text-xs text-muted-foreground">
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resending || animationState !== "idle"}
            className={cn(
              "flex items-center gap-1.5 font-medium transition-colors hover:text-foreground active-spring",
              resendCooldown > 0 ? "opacity-60 cursor-not-allowed" : "text-primary hover:underline cursor-pointer"
            )}
          >
            <RefreshCw className={cn("size-3.5", resending && "animate-spin")} />
            {resendCooldown > 0 ? (
              <span>Resend code in {resendCooldown}s</span>
            ) : (
              <span>Resend code</span>
            )}
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={animationState !== "idle"}
              className="flex items-center gap-1 hover:text-foreground hover:underline active-spring"
            >
              <ArrowLeft className="size-3.5" />
              <span>Change email</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
