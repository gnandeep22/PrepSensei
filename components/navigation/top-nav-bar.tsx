"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Search,
  Target,
  MessagesSquare,
  ClipboardList,
  FileText,
  CalendarCheck,
  UserRound,
  Briefcase,
  Users,
  ClipboardCheck,
  BarChart3,
  Sparkles,
  GraduationCap,
  LogOut,
  Loader2,
  Menu,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { NotificationBell } from "@/components/candidate/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"

export interface TopNavBarProps {
  role: "candidate" | "recruiter"
  userName: string
  userEmail: string
  onSignOut: () => Promise<void>
}

const candidateNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Find Jobs", icon: Search },
  { href: "/matches", label: "Job Matches", icon: Target },
  { href: "/interview", label: "AI Mock Interview", icon: MessagesSquare },
  { href: "/assessment", label: "Assessments", icon: ClipboardList },
  { href: "/resume", label: "Resume & CV", icon: FileText },
  { href: "/study-plan", label: "Study Plan", icon: CalendarCheck },
  { href: "/profile", label: "Profile", icon: UserRound },
]

const recruiterNav = [
  { href: "/recruiter", label: "Overview", icon: LayoutDashboard },
  { href: "/recruiter/jobs", label: "Job Postings", icon: Briefcase },
  { href: "/recruiter/job-creator", label: "JD Creator", icon: Sparkles },
  { href: "/recruiter/candidates", label: "Candidates", icon: Users },
  { href: "/recruiter/assessments", label: "Assessments", icon: ClipboardCheck },
  { href: "/recruiter/results", label: "Results", icon: BarChart3 },
]

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "PS"
  )
}

export function TopNavBar({ role, userName, userEmail, onSignOut }: TopNavBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const navItems = role === "recruiter" ? recruiterNav : candidateNav

  // Container & items ref for calculating thick liquid bubble coordinates
  const trackRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const prevIndexRef = useRef<number>(0)
  const prevLeftRef = useRef<number>(0)

  // State for bouncy bubble position & width
  const [bubble, setBubble] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  })

  // State for tracked hovered button
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Find index of currently active link
  const activeIndex = useMemo(() => {
    return navItems.findIndex(({ href }) => {
      const exact = href === "/" || href === "/recruiter"
      return exact ? pathname === href : pathname.startsWith(href)
    })
  }, [navItems, pathname])

  // Move bubble to target element with minimal, silky-smooth glide matching Spline 3D
  const updateBubbleToElement = (newIndex: number) => {
    const el = itemRefs.current[newIndex]
    if (!el || !trackRef.current) {
      setBubble((prev) => ({ ...prev, opacity: 0 }))
      return
    }
    const trackRect = trackRef.current.getBoundingClientRect()
    const itemRect = el.getBoundingClientRect()

    const newLeft = Math.round(itemRect.left - trackRect.left)
    const newWidth = Math.round(itemRect.width)

    prevIndexRef.current = newIndex
    prevLeftRef.current = newLeft

    setBubble({
      left: newLeft,
      width: newWidth,
      opacity: 1,
    })
  }

  // Update bubble position when route changes or component mounts
  useEffect(() => {
    if (activeIndex >= 0) {
      const frameId = requestAnimationFrame(() => {
        updateBubbleToElement(activeIndex)
      })
      return () => cancelAnimationFrame(frameId)
    } else {
      setBubble((prev) => ({ ...prev, opacity: 0 }))
    }
  }, [activeIndex, pathname])

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => {
      const targetIdx = hoveredIndex !== null ? hoveredIndex : activeIndex
      if (targetIdx >= 0) updateBubbleToElement(targetIdx)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [activeIndex, hoveredIndex])

  const handleMouseEnter = (index: number) => {
    setHoveredIndex(index)
    updateBubbleToElement(index)
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
    if (activeIndex >= 0) {
      updateBubbleToElement(activeIndex)
    } else {
      setBubble((prev) => ({ ...prev, opacity: 0 }))
    }
  }

  const [scrolled, setScrolled] = useState(false)

  // Scroll edge effect (WWDC25: adaptive elevation over content)
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleSignOutClick = async () => {
    setSigningOut(true)
    await onSignOut()
  }

  return (
    <header className="sticky top-3 sm:top-4 z-40 w-full px-3 sm:px-6 pointer-events-none transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* Left Island: Brand Capsule with Specular Glass Texture */}
        <div
          className={cn(
            "apple-liquid-glass rounded-full px-3.5 sm:px-4 py-2 pointer-events-auto flex items-center gap-2.5 transition-all duration-300 hover:scale-[1.01] active:scale-[0.98]",
            scrolled
              ? "shadow-2xl border-white/85 dark:border-white/20 bg-white/85 dark:bg-zinc-900/85"
              : "shadow-md border-white/65 dark:border-white/12"
          )}
        >
          <Link
            href={role === "recruiter" ? "/recruiter" : "/"}
            className="group flex items-center gap-2.5"
          >
            <div className="flex size-7.5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_2px_12px_rgba(250,79,97,0.45)] transition-transform group-hover:scale-105 duration-150">
              <GraduationCap className="size-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-foreground text-xs sm:text-sm">
                  PREPSENSEI
                </span>
                <Badge
                  variant="outline"
                  className="hidden md:inline-flex text-[9px] font-semibold py-0 px-1.5 border-primary/30 bg-primary/10 text-primary capitalize"
                >
                  {role}
                </Badge>
              </div>
            </div>
          </Link>
        </div>

        {/* Center Island: The Optical Glass Menu Bar (Matches WWDC25 Liquid Glass) */}
        <nav
          ref={trackRef}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "relative hidden lg:flex items-center rounded-full p-1.5 apple-liquid-glass pointer-events-auto transition-all duration-300",
            scrolled
              ? "shadow-2xl border-white/85 dark:border-white/20 bg-white/85 dark:bg-zinc-900/85"
              : "shadow-xl border-white/65 dark:border-white/12"
          )}
        >
          {/* WWDC25 Liquid Glass Sliding Lens Droplet */}
          <div
            className="pointer-events-none absolute top-1.5 bottom-1.5 left-0 rounded-full spline-liquid-droplet spline-liquid-glide z-20 overflow-hidden"
            style={{
              transform: `translate3d(${bubble.left}px, 0, 0)`,
              width: `${bubble.width}px`,
              opacity: bubble.opacity,
            }}
          >
            {/* Specular perimeter highlight (highlights layer) */}
            <div className="pointer-events-none absolute inset-x-2 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/95 dark:via-white/55 to-transparent" />
            {/* Bottom refraction rim */}
            <div className="pointer-events-none absolute inset-x-3 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/35 dark:via-white/10 to-transparent" />
            {/* Internal light illumination & translucent coral tint */}
            <div className="absolute inset-0 rounded-full bg-primary/[0.05] dark:bg-primary/[0.08]" />
          </div>

          {navItems.map((item, idx) => {
            const exact = item.href === "/" || item.href === "/recruiter"
            const isActive = exact ? pathname === item.href : pathname.startsWith(item.href)
            const currentFocusIndex = hoveredIndex !== null ? hoveredIndex : activeIndex
            const isFocused = idx === currentFocusIndex
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => {
                  itemRefs.current[idx] = el
                }}
                onMouseEnter={() => handleMouseEnter(idx)}
                className={cn(
                  "relative z-10 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium select-none antialiased",
                  "cursor-pointer active:scale-[0.97] transition-all duration-150",
                  isFocused
                    ? "text-primary font-semibold drop-shadow-[0_1px_4px_rgba(250,79,97,0.35)]"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 hover:dark:text-white"
                )}
              >
                <span className="flex items-center gap-1.5 leading-none">
                  <Icon
                    className={cn(
                      "size-3.5 transition-colors duration-150 shrink-0",
                      isFocused ? "text-primary" : "text-zinc-500 dark:text-zinc-400"
                    )}
                  />
                  <span className={cn("transition-colors duration-150", isFocused ? "text-primary font-semibold" : "text-zinc-600 dark:text-zinc-400")}>
                    {item.label}
                  </span>
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Right Island: Controls & User Profile Pill */}
        <div
          className={cn(
            "apple-liquid-glass rounded-full p-1 sm:p-1.5 pointer-events-auto flex items-center gap-1.5 sm:gap-2 transition-all duration-300",
            scrolled
              ? "shadow-2xl border-white/85 dark:border-white/20 bg-white/85 dark:bg-zinc-900/85"
              : "shadow-lg border-white/65 dark:border-white/12"
          )}
        >
          <ThemeToggle />
          {role === "candidate" && <NotificationBell />}

          {/* User Profile Capsule Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className={cn(
                "flex items-center gap-2 rounded-full p-0.5 sm:pr-2.5 transition-all duration-150 active:scale-[0.97] cursor-pointer",
                userMenuOpen && "ring-2 ring-primary/40 bg-white/25 dark:bg-white/10"
              )}
              aria-label="User profile menu"
            >
              <div className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold border border-primary/35 shadow-xs">
                {initials(userName)}
              </div>
              <span className="hidden sm:inline-block text-xs font-semibold text-foreground max-w-[90px] truncate">
                {userName.split(" ")[0]}
              </span>
              <ChevronDown className="size-3 text-muted-foreground hidden sm:block" />
            </button>

            {/* Profile Dropdown Card with Liquid Glass Backdrop (WWDC25 Pop-open Menu) */}
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 rounded-3xl apple-liquid-glass p-2.5 shadow-2xl z-50 origin-top-right overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
                  {/* Concentrated perimeter specular highlight along top edge */}
                  <div className="pointer-events-none absolute inset-x-3 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/95 dark:via-white/35 to-transparent" />
                  <div className="px-3 py-2 border-b border-white/20 dark:border-white/10">
                    <p className="text-xs font-bold text-foreground truncate">{userName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-white/20 dark:hover:bg-white/10 transition-colors duration-150 active:scale-[0.98]"
                    >
                      <UserRound className="size-3.5 text-primary" />
                      View Profile
                    </Link>
                    {role === "candidate" && (
                      <Link
                        href="/interview"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-white/20 dark:hover:bg-white/10 transition-colors duration-150 active:scale-[0.98]"
                      >
                        <MessagesSquare className="size-3.5 text-primary" />
                        AI Mock Interview
                      </Link>
                    )}
                  </div>

                  <div className="border-t border-white/20 dark:border-white/10 pt-1">
                    <button
                      type="button"
                      onClick={handleSignOutClick}
                      disabled={signingOut}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer active:scale-[0.98]"
                    >
                      {signingOut ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <LogOut className="size-3.5" />
                      )}
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu Hamburger (Visible on small screens) */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="lg:hidden rounded-full size-8 hover:bg-white/20 dark:hover:bg-white/10 cursor-pointer"
          >
            <Menu className="size-4" />
          </Button>
        </div>
      </div>

      {/* Mobile Drawer (Sheet) with Liquid Glass Styling */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="top" className="max-h-[85vh] overflow-y-auto apple-liquid-glass p-5 rounded-b-3xl border-b border-white/30 dark:border-white/15">
          <SheetTitle className="text-sm font-bold tracking-tight text-foreground flex items-center justify-between pb-3 border-b border-white/20 dark:border-white/10">
            <span className="flex items-center gap-2">
              <GraduationCap className="size-4.5 text-primary" />
              Navigation
            </span>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px] capitalize">
              {role}
            </Badge>
          </SheetTitle>

          <nav className="flex flex-col gap-1.5 pt-4">
            {navItems.map((item) => {
              const exact = item.href === "/" || item.href === "/recruiter"
              const isActive = exact ? pathname === item.href : pathname.startsWith(item.href)
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all active:scale-95",
                    isActive
                      ? "bg-primary text-primary-foreground font-bold shadow-[0_2px_14px_rgba(250,79,97,0.35)]"
                      : "text-zinc-900 dark:text-zinc-100 hover:bg-white/20 dark:hover:bg-white/10 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", isActive ? "text-white" : "text-primary")} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  )
}
