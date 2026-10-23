"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { GraduationCap, UserRound, Building2, Mail, ArrowLeft, RefreshCw, KeyRound, CheckCircle2, ScanFace, LogOut } from "lucide-react"
import { signIn, signUp, signOut } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { FaceVerification } from "@/components/face/face-verification"
import { OtpVerificationCard } from "@/components/auth/otp-verification-card"

type Mode = "sign-in" | "sign-up"
type Role = "candidate" | "recruiter"
type SignUpStep = "details" | "otp"

const roleOptions: { value: Role; label: string; description: string; icon: typeof UserRound }[] = [
  {
    value: "candidate",
    label: "Candidate",
    description: "Prepare, apply and interview",
    icon: UserRound,
  },
  {
    value: "recruiter",
    label: "Recruiter",
    description: "Build assessments and hire",
    icon: Building2,
  },
]

export function AuthForm({ mode, forceFaceReg = false }: { mode: Mode; forceFaceReg?: boolean }) {
  const router = useRouter()
  const isSignUp = mode === "sign-up"

  const [signUpStep, setSignUpStep] = useState<SignUpStep>("details")
  const [showFaceReg, setShowFaceReg] = useState(forceFaceReg)
  const [showFaceLogin, setShowFaceLogin] = useState(false)
  const [name, setName] = useState("")

  useEffect(() => {
    if (forceFaceReg) {
      setShowFaceReg(true)
    }
  }, [forceFaceReg])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>("candidate")
  const [otp, setOtp] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((c) => (c > 0 ? c - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  async function handleSendOtp() {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.")
      return false
    }
    if (isSignUp && !name.trim()) {
      setError("Please enter your full name.")
      return false
    }
    if (isSignUp && password.length < 8) {
      setError("Password must be at least 8 characters.")
      return false
    }

    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          email: email.trim(),
          name: name.trim(),
          role,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || "Failed to send verification code.")
        setLoading(false)
        return false
      }

      setResendCooldown(60)
      setSignUpStep("otp")
      setLoading(false)
      return true
    } catch {
      setError("Unable to send verification code. Please check your connection.")
      setLoading(false)
      return false
    }
  }

  async function handleVerifyOtpAndSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (otp.trim().length < 6) {
      setError("Please enter the complete 6-digit verification code.")
      return
    }

    setError(null)
    setLoading(true)

    try {
      // 1. Verify OTP
      const verifyRes = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          email: email.trim(),
          otp: otp.trim(),
        }),
      })

      const verifyData = await verifyRes.json()
      if (!verifyRes.ok || verifyData.error) {
        setError(verifyData.error || "Invalid verification code.")
        setLoading(false)
        return
      }

      // 2. Create authenticated account via BetterAuth
      const { error: signUpError } = await signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      } as any)

      if (signUpError) {
        setError(signUpError.message ?? "Could not create your account.")
        setLoading(false)
        return
      }

      setLoading(false)

      // Recruiter signup: NO face registration required!
      if (role === "recruiter") {
        router.push("/recruiter")
        router.refresh()
        return
      }

      // Candidate signup: proceed to biometric face registration
      setShowFaceReg(true)
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/sign-up?step=face")
      }
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (isSignUp) {
      // Send OTP to email before creating account
      await handleSendOtp()
      return
    }

    // Sign in flow
    setLoading(true)
    try {
      const { data, error: signInError } = await signIn.email({ email: email.trim(), password })
      if (signInError) {
        setError("Incorrect email or password.")
        setLoading(false)
        return
      }

      if ((data?.user as any)?.role === "recruiter") {
        router.push("/recruiter")
        router.refresh()
        return
      }

      // Candidate sign in: verify that biometric face registration is completed
      try {
        const faceRes = await fetch("/api/face")
        const faceData = await faceRes.json()
        if (faceData?.authenticated && !faceData?.registered) {
          setShowFaceReg(true)
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", "/sign-up?step=face")
          }
          setLoading(false)
          return
        }
      } catch {}

      router.push("/")
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }



  // Face Sign-In step (Vision authentication)
  if (showFaceLogin) {
    return (
      <div className="w-full max-w-md rounded-3xl glass-apple-card specular-border p-6 sm:p-8 flex flex-col gap-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs">
            <ScanFace className="size-6" />
          </div>
          <p className="text-[11px] font-bold tracking-widest text-primary uppercase">PREPSENSEI</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Face Vision Sign-In</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Look directly at the camera. The AI will recognize your registered biometrics and sign you in automatically.
          </p>
        </div>

        <FaceVerification
          mode="login"
          embedded={true}
          targetEmail={email ? email.trim() : undefined}
          autoStart={true}
          onComplete={async (_desc, _photo, userData) => {
            // Once /api/face verifies and creates session cookie, redirect directly
            const userRole = userData?.role || "candidate"
            if (userRole === "recruiter") {
              window.location.replace("/recruiter")
            } else {
              window.location.replace("/")
            }
          }}
          onSkip={() => setShowFaceLogin(false)}
        />

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError(null)
            setShowFaceLogin(false)
          }}
          className="w-full text-xs"
        >
          <ArrowLeft className="size-4 mr-2" /> Back to email &amp; password sign-in
        </Button>
      </div>
    )
  }

  // Face Registration step (Candidates only - mandatory)
  if (showFaceReg) {
    return (
      <div className="w-full max-w-md rounded-3xl glass-apple-card specular-border p-6 sm:p-8 flex flex-col gap-4">
        <div className="text-center">
          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs mb-2 rounded-full px-3 py-0.5">
            Step 2 of 2 · Mandatory Biometric Registration
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Register Your Face Biometrics</h1>
          <p className="mt-1 text-xs text-muted-foreground text-pretty">
            Align your face in the camera frame to register your biometric identity. PrepSensei requires this to verify candidate identity and prevent interview impersonation.
          </p>
        </div>

        <FaceVerification
          mode="register"
          embedded={true}
          onComplete={() => {
            window.location.replace("/")
          }}
        />

        <div className="text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut()
              window.location.replace("/sign-in")
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5 mr-1.5" /> Sign out &amp; return to sign in
          </Button>
        </div>
      </div>
    )
  }

  // Step 2 of Signup: Orbital OTP Email Verification (Reference 1)
  if (isSignUp && signUpStep === "otp") {
    return (
      <OtpVerificationCard
        email={email}
        name={name}
        role={role}
        onBack={() => {
          setError(null)
          setSignUpStep("details")
        }}
        onResend={async () => {
          return await handleSendOtp()
        }}
        onVerified={async () => {
          setLoading(true)
          try {
            // Create authenticated account via BetterAuth
            const { error: signUpError } = await signUp.email({
              name: name.trim(),
              email: email.trim(),
              password,
              role,
            } as any)

            if (signUpError) {
              const msg = signUpError.message ?? "Could not create your account."
              setError(msg)
              setLoading(false)
              throw new Error(msg)
            }

            setLoading(false)

            if (role === "recruiter") {
              window.location.href = "/recruiter"
              return
            }

            // Candidate signup: proceed to biometric face registration
            setSignUpStep("details")
            setShowFaceReg(true)
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", "/sign-up?step=face")
            }
          } catch (err: any) {
            const msg = err?.message || "Something went wrong. Please try again."
            setError(msg)
            setLoading(false)
            throw err instanceof Error ? err : new Error(msg)
          }
        }}
      />
    )
  }

  return (
    <div className="w-full max-w-md rounded-3xl glass-apple-card specular-border p-6 sm:p-8 transition-all">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs">
          <GraduationCap className="size-6" />
        </div>
        <div>
          <p className="text-[11px] font-bold tracking-widest text-primary uppercase">PREPSENSEI</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground text-balance">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground text-pretty">
            {isSignUp
              ? "Start preparing smarter with AI-guided career tools."
              : "Sign in to continue your career preparation."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">I am a</legend>
            <div className="grid grid-cols-2 gap-3">
              {roleOptions.map(({ value, label, description, icon: Icon }) => {
                const selected = role === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    aria-pressed={selected}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition-all duration-200 active-spring",
                      selected
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/60"
                        : "border-border/70 bg-card/40 hover:border-primary/40 hover:bg-accent/60",
                    )}
                  >
                    <Icon className={cn("size-4.5", selected ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-[11px] leading-tight text-muted-foreground">{description}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {isSignUp && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" className="text-xs font-medium">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aisha Rahman"
              required
              autoComplete="name"
              className="h-11 rounded-xl border-border/70 bg-card/60 backdrop-blur-md focus:ring-2 focus:ring-primary/40"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-xs font-medium">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="h-11 rounded-xl border-border/70 bg-card/60 backdrop-blur-md focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-xs font-medium">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className="h-11 rounded-xl border-border/70 bg-card/60 backdrop-blur-md focus:ring-2 focus:ring-primary/40"
          />
          {isSignUp && <p className="text-[11px] text-muted-foreground">At least 8 characters.</p>}
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs font-medium text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="mt-1 w-full h-11 rounded-xl font-semibold active-spring shadow-xs">
          {loading ? "Please wait…" : isSignUp ? "Continue with Verification" : "Sign in"}
        </Button>

        {!isSignUp && (
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60" />
              </div>
              <span className="relative bg-card/90 backdrop-blur-md px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Or instant vision sign-in
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError(null)
                setShowFaceLogin(true)
              }}
              className="w-full h-11 rounded-xl flex items-center justify-center gap-2 border-primary/40 bg-card/40 hover:border-primary hover:bg-primary/10 transition-all text-xs font-semibold active-spring"
            >
              <ScanFace className="size-4 text-primary" />
              Sign in with Face ID
            </Button>
          </div>
        )}
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {isSignUp ? (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            {"Don't have an account? "}
            <Link href="/sign-up" className="font-semibold text-primary hover:underline">
              Create one
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
