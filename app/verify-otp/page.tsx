"use client"

import React, { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { GraduationCap, ArrowLeft, Mail, Loader2 } from "lucide-react"
import { OtpVerificationCard } from "@/components/auth/otp-verification-card"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function VerifyOtpContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const emailParam = searchParams.get("email") || ""
  const roleParam = (searchParams.get("role") as "candidate" | "recruiter") || "candidate"
  const nameParam = searchParams.get("name") || ""

  const [email, setEmail] = useState(emailParam)
  const [hasEmail, setHasEmail] = useState(Boolean(emailParam))
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const handleStartWithEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes("@")) {
      setSendError("Please enter a valid email address.")
      return
    }

    setSending(true)
    setSendError(null)

    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          email: email.trim(),
          name: nameParam,
          role: roleParam,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setHasEmail(true)
      } else {
        setSendError(data.error || "Failed to send verification code.")
      }
    } catch {
      setSendError("Connection error. Please try again.")
    } finally {
      setSending(false)
    }
  }

  const handleVerified = async (otp: string) => {
    // If there's pending signup data in sessionStorage, complete signup
    try {
      const pendingData = sessionStorage.getItem("prepsensei_pending_signup")
      if (pendingData) {
        const parsed = JSON.parse(pendingData)
        if (parsed.email === email && parsed.password) {
          const { signUp } = await import("@/lib/auth-client")
          const { error } = await signUp.email({
            email: parsed.email,
            password: parsed.password,
            name: parsed.name,
            role: parsed.role,
          } as any)
          if (!error) {
            sessionStorage.removeItem("prepsensei_pending_signup")
            if (parsed.role === "recruiter") {
              router.push("/recruiter")
            } else {
              router.push("/sign-up?step=face")
            }
            router.refresh()
            return
          }
        }
      }
    } catch {}

    // Fallback: Redirect to face verification or sign-in
    setTimeout(() => {
      if (roleParam === "recruiter") {
        router.push("/recruiter")
      } else {
        router.push("/sign-up?step=face")
      }
      router.refresh()
    }, 1200)
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Top Bar with Brand & Theme Switcher */}
      <div className="flex w-full items-center justify-between max-w-4xl mx-auto">
        <Link
          href="/sign-in"
          className="flex items-center gap-2 group transition-transform active-spring"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <GraduationCap className="size-5 transition-transform duration-300 group-hover:scale-110" />
          </div>
          <span className="font-bold tracking-wider text-sm text-foreground">
            PREPSENSEI
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      {/* Main Content Card */}
      <div className="my-auto w-full flex items-center justify-center py-8">
        {!hasEmail ? (
          <div className="w-full max-w-md rounded-3xl glass-apple-card specular-border p-6 sm:p-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Mail className="size-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Email Verification
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter your email address to receive your 4-digit verification code.
              </p>
            </div>

            <form onSubmit={handleStartWithEmail} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="verify-email">Email address</Label>
                <Input
                  id="verify-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoFocus
                  className="h-11 rounded-xl"
                />
              </div>

              {sendError && (
                <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {sendError}
                </p>
              )}

              <Button type="submit" disabled={sending} className="w-full rounded-xl h-11 active-spring">
                {sending ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Sending code…
                  </>
                ) : (
                  "Send 4-Digit Code"
                )}
              </Button>

              <div className="text-center pt-2">
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  <ArrowLeft className="size-3.5" /> Back to sign in
                </Link>
              </div>
            </form>
          </div>
        ) : (
          <OtpVerificationCard
            email={email}
            name={nameParam}
            role={roleParam}
            onVerified={handleVerified}
            onBack={() => setHasEmail(false)}
          />
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pb-2">
        PrepSensei · Real-time AI Career &amp; Interview Intelligence Platform
      </div>
    </div>
  )
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  )
}
