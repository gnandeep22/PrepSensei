"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
import { GraduationCap, LogOut, Loader2, ScanFace } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { signOut, useSession } from "@/lib/auth-client"
import { FaceVerification } from "@/components/face/face-verification"
import { ThemeToggle } from "@/components/theme-toggle"
import { SidebarNav } from "@/components/navigation/sidebar-nav"
import { NotificationProvider } from "@/components/candidate/notification-bell"
import { cn } from "@/lib/utils"

const AUTH_ROUTES = ["/sign-in", "/sign-up", "/verify-otp"]
const PUBLIC_ROUTES = ["/how-it-works"]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, isPending } = useSession()

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  const role = (session?.user as { role?: string } | undefined)?.role === "recruiter" ? "recruiter" : "candidate"
  const userName = session?.user?.name || "Account"
  const userEmail = session?.user?.email || ""

  // Biometric restriction: Candidates must register their face before accessing the platform
  const [faceRegistered, setFaceRegistered] = useState<boolean | null>(() => {
    if (role === "recruiter") return true
    if (typeof window !== "undefined" && session?.user?.id) {
      return sessionStorage.getItem(`prepsensei_face_reg_${session.user.id}`) === "true" ? true : null
    }
    return null
  })

  // Collapsible sidebar state persisted in localStorage
  const [minimized, setMinimized] = useState<boolean>(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("prepsensei_sidebar_minimized")
      if (stored === "true") {
        setMinimized(true)
      }
    } catch {}
  }, [])

  const handleToggleMinimize = () => {
    setMinimized((prev) => {
      const next = !prev
      try {
        localStorage.setItem("prepsensei_sidebar_minimized", String(next))
      } catch {}
      return next
    })
  }

  useEffect(() => {
    if (!isPending && !session?.user && !isAuthRoute && !isPublicRoute) {
      router.replace("/sign-in")
    }
  }, [isPending, session, isAuthRoute, isPublicRoute, router])

  useEffect(() => {
    if (!session?.user || isAuthRoute) return
    const userRole = (session.user as { role?: string }).role === "recruiter" ? "recruiter" : "candidate"
    if (userRole === "recruiter") {
      setFaceRegistered(true)
      return
    }

    const cacheKey = `prepsensei_face_reg_${session.user.id}`
    try {
      if (sessionStorage.getItem(cacheKey) === "true") {
        setFaceRegistered(true)
        return
      }
    } catch {}

    fetch("/api/face")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated) {
          if (data.registered) {
            setFaceRegistered(true)
            try {
              sessionStorage.setItem(cacheKey, "true")
            } catch {}
          } else {
            setFaceRegistered(false)
            try {
              sessionStorage.removeItem(cacheKey)
            } catch {}
          }
        }
      })
      .catch(() => {
        setFaceRegistered(true)
      })
  }, [session?.user, isAuthRoute])

  async function handleAppShellSignOut() {
    await signOut()
    router.push("/sign-in")
    router.refresh()
  }

  // Auth pages render with Apple ambient illumination and quick ThemeToggle
  if (isAuthRoute) {
    return (
      <div className="app-frame relative flex min-h-svh items-center justify-center bg-background px-4 py-8">
        <div aria-hidden="true" className="ambient-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden"><div className="ambient-orb ambient-orb-one" /><div className="ambient-orb ambient-orb-two" /></div>
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        {children}
      </div>
    )
  }

  // Wait for the session to resolve before deciding what to render
  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    )
  }

  // Public route access when not logged in (e.g. /how-it-works product tour)
  if (!session?.user && isPublicRoute) {
    return (
      <div className="app-frame relative flex min-h-svh flex-col bg-background text-foreground antialiased selection:bg-primary/20">
        <div aria-hidden="true" className="ambient-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden"><div className="ambient-orb ambient-orb-one" /><div className="ambient-orb ambient-orb-two" /></div>
        <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/sign-in" className="flex items-center gap-2 group">
            <div className="brand-mark flex size-7 items-center justify-center rounded-xl text-white shadow-xs">
              <GraduationCap className="size-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">PrepSensei</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/sign-in" />}>
              Sign In
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href="/sign-up" />}>
              Get Started
            </Button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    )
  }

  // Route protection: no session means the user must sign in
  if (!session?.user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Redirecting" />
      </div>
    )
  }

  // While checking biometric status for candidates, show loading state
  if (role === "candidate" && faceRegistered === null) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Checking biometric registration" />
      </div>
    )
  }

  // RESTRICT candidate if face biometrics are not registered!
  if (role === "candidate" && faceRegistered === false) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md flex flex-col gap-4">
          <div className="text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <ScanFace className="size-6" />
            </div>
            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs mb-2">
              Biometric Registration Required
            </Badge>
            <h1 className="text-xl font-bold tracking-tight">Complete Face Registration</h1>
            <p className="mt-1 text-xs text-muted-foreground text-pretty">
              To prevent impersonation and guarantee interview integrity, you must register your face biometrics before accessing PrepSensei.
            </p>
          </div>

          <FaceVerification
            mode="register"
            embedded={true}
            onComplete={() => {
              setFaceRegistered(true)
              if (session?.user?.id) {
                try {
                  sessionStorage.setItem(`prepsensei_face_reg_${session.user.id}`, "true")
                } catch {}
              }
              router.refresh()
            }}
          />

          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAppShellSignOut}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-3.5 mr-1.5" /> Sign out &amp; return to sign in
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <NotificationProvider>
      <div className="app-frame relative flex min-h-svh bg-background text-foreground antialiased overflow-x-hidden">
        <div aria-hidden="true" className="ambient-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="ambient-orb ambient-orb-one" />
          <div className="ambient-orb ambient-orb-two" />
        </div>

        {/* Left Floating Glass Sidebar (matching WWDC25 Session 219 reference photo) */}
        <SidebarNav
          role={role}
          userName={userName}
          userEmail={userEmail}
          onSignOut={handleAppShellSignOut}
          minimized={minimized}
          onToggleMinimize={handleToggleMinimize}
        />

        {/* Main Content Area with clear depth separation from left sidebar */}
        <div
          className={cn(
            "flex-1 min-w-0 flex flex-col transition-all duration-300 ease-in-out",
            minimized ? "lg:pl-28" : "lg:pl-72 xl:pl-80"
          )}
        >
          <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-6 max-w-[1400px] w-full mx-auto">
            <div className="flex w-full flex-col gap-4 sm:gap-5">{children}</div>
          </main>
        </div>
      </div>
    </NotificationProvider>
  )
}
