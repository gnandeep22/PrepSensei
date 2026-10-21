"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
  ChevronDown,
  LogOut,
  PanelLeft,
  Menu,
  X,
  GraduationCap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  NotificationBell,
  NotificationPanel,
} from "@/components/candidate/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"

export interface SidebarNavProps {
  role: "candidate" | "recruiter"
  userName: string
  userEmail: string
  onSignOut: () => Promise<void>
  minimized?: boolean
  onToggleMinimize?: () => void
}

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  title?: string
  collapsible?: boolean
  items: NavItem[]
}

const candidateSections: NavSection[] = [
  {
    items: [
      { href: "/jobs", label: "Search", icon: Search },
      { href: "/", label: "Home", icon: LayoutDashboard },
      { href: "/matches", label: "Job Matches", icon: Target },
    ],
  },
  {
    title: "Preparation",
    collapsible: true,
    items: [
      { href: "/interview", label: "AI Mock Interview", icon: MessagesSquare },
      { href: "/assessment", label: "Assessments", icon: ClipboardList },
      { href: "/resume", label: "Resume & CV", icon: FileText },
      { href: "/study-plan", label: "Study Plan", icon: CalendarCheck },
    ],
  },
  {
    title: "Account",
    collapsible: true,
    items: [
      { href: "/profile", label: "Profile", icon: UserRound },
      { href: "/how-it-works", label: "How AI Works", icon: Sparkles },
    ],
  },
]

const recruiterSections: NavSection[] = [
  {
    items: [
      { href: "/recruiter", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    title: "Recruitment",
    collapsible: true,
    items: [
      { href: "/recruiter/jobs", label: "Job Postings", icon: Briefcase },
      { href: "/recruiter/job-creator", label: "JD Creator", icon: Sparkles },
      { href: "/recruiter/candidates", label: "Candidates", icon: Users },
    ],
  },
  {
    title: "Evaluation",
    collapsible: true,
    items: [
      { href: "/recruiter/assessments", label: "Assessments", icon: ClipboardCheck },
      { href: "/recruiter/results", label: "Results", icon: BarChart3 },
      { href: "/how-it-works", label: "AI Architecture", icon: Sparkles },
    ],
  },
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

export function SidebarNav({
  role,
  userName,
  userEmail: _userEmail,
  onSignOut,
  minimized = false,
  onToggleMinimize,
}: SidebarNavProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  const sections = role === "recruiter" ? recruiterSections : candidateSections

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }))
  }

  const isItemActive = (href: string) => {
    if (href === "/" || href === "/recruiter") {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await onSignOut()
    } finally {
      setSigningOut(false)
    }
  }

  const renderNavContent = (isRail: boolean) => (
    <div className={cn("flex h-full flex-col justify-between select-none", isRail && "items-center")}>
      {/* Top Header & Navigation Links */}
      <div className={cn("flex flex-col gap-2.5 w-full", isRail && "items-center")}>
        {/* Top Header Row matching WWDC25 Session 219 reference */}
        {isRail ? (
          <div className="flex flex-col items-center gap-2 pt-1 pb-1">
            <Link
              href={role === "recruiter" ? "/recruiter" : "/"}
              title="PrepSensei Home"
              className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-rose-600 text-white shadow-xs transition-transform active:scale-95"
            >
              <GraduationCap className="size-5" />
            </Link>
            <button
              type="button"
              onClick={onToggleMinimize}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="flex size-8 items-center justify-center rounded-xl text-muted-foreground/80 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <PanelLeft className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2 pt-1 pb-1">
            <Link
              href={role === "recruiter" ? "/recruiter" : "/"}
              className="group flex items-center gap-2 transition-transform active:scale-95"
            >
              <div className="flex size-7 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-rose-600 text-white shadow-xs">
                <GraduationCap className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
                  PrepSensei
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={onToggleMinimize}
              title="Minimize sidebar"
              aria-label="Minimize sidebar"
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/80 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <PanelLeft className="size-4" />
            </button>
          </div>
        )}

        {/* Separator hairline */}
        <div className={cn("h-px bg-white/40 dark:bg-white/10", isRail ? "w-8 my-1" : "mx-2")} />

        {/* Nav Sections */}
        <nav
          className={cn(
            "flex flex-col mt-1 overflow-y-auto scrollbar-none max-h-[calc(100vh-250px)]",
            isRail ? "items-center gap-2 w-full px-0" : "gap-3 px-1"
          )}
        >
          {sections.map((section, sIdx) => {
            const isCollapsed = section.title && !isRail ? Boolean(collapsedSections[section.title]) : false

            return (
              <div key={sIdx} className={cn("flex flex-col w-full", isRail ? "items-center gap-1.5" : "gap-0.5")}>
                {/* Section Header with Chevron (expanded mode only) */}
                {!isRail && section.title && (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title!)}
                    className="flex w-full items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-muted-foreground/80 hover:text-foreground transition-colors group"
                  >
                    <span>{section.title}</span>
                    {section.collapsible && (
                      <ChevronDown
                        className={cn(
                          "size-3.5 transition-transform duration-200 text-muted-foreground/60 group-hover:text-foreground",
                          isCollapsed && "-rotate-90"
                        )}
                      />
                    )}
                  </button>
                )}

                {/* Subtle Divider for Rail mode when section has title */}
                {isRail && section.title && (
                  <div className="my-1 size-1 rounded-full bg-muted-foreground/30" />
                )}

                {/* Section Items */}
                {!isCollapsed && (
                  <div className={cn("flex flex-col w-full", isRail ? "items-center gap-1.5" : "gap-0.5")}>
                    {section.items.map((item) => {
                      const active = isItemActive(item.href)
                      const Icon = item.icon

                      if (isRail) {
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            title={item.label}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "group relative flex size-10 items-center justify-center rounded-2xl transition-all duration-150 active:scale-95",
                              active
                                ? "liquid-glass-nav-active text-primary shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                            )}
                          >
                            <Icon
                              className={cn(
                                "size-4.5 shrink-0 transition-transform duration-150 group-hover:scale-110",
                                active ? "text-primary stroke-[2.25]" : "stroke-[1.75]"
                              )}
                            />
                          </Link>
                        )
                      }

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "group flex items-center gap-3 rounded-2xl px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-[0.98]",
                            active
                              ? "liquid-glass-nav-active text-primary font-semibold"
                              : "text-foreground/85 hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-4 shrink-0 transition-transform duration-150 group-hover:scale-105",
                              active
                                ? "text-primary stroke-[2.25]"
                                : "text-muted-foreground group-hover:text-foreground stroke-[1.75]"
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      {/* Bottom User Area & Quick Controls */}
      {isRail ? (
        <div className="flex flex-col items-center gap-2 pt-2 border-t border-white/40 dark:border-white/10 w-full">
          <Link
            href="/profile"
            title={`${userName} (${role})`}
            className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 text-xs font-semibold text-primary hover:opacity-80 transition-opacity active:scale-95"
          >
            {initials(userName)}
          </Link>
          <NotificationBell />
          <ThemeToggle />
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            title={signingOut ? "Signing out..." : "Sign out"}
            className="flex size-8 items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 pt-2 border-t border-white/40 dark:border-white/10 px-1">
          {/* User Profile Tile */}
          <div className="flex items-center justify-between rounded-2xl p-2 bg-white/40 dark:bg-white/[0.04] border border-white/50 dark:border-white/10 backdrop-blur-md">
            <Link
              href="/profile"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition-opacity"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 text-xs font-semibold text-primary">
                {initials(userName)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-foreground truncate">{userName}</span>
                <span className="text-[10px] text-muted-foreground capitalize truncate">
                  {role} account
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-1.5 shrink-0">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl py-1.5 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="size-3.5" />
            <span>{signingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile Top Header (only on screens < lg) */}
      <header className="lg:hidden sticky top-3 z-40 mx-4 mb-3 flex items-center justify-between rounded-2xl liquid-glass-sidebar px-3.5 py-2.5 shadow-lg">
        <Link
          href={role === "recruiter" ? "/recruiter" : "/"}
          className="flex items-center gap-2 active:scale-95 transition-transform"
        >
          <div className="flex size-7 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-rose-600 text-white shadow-xs">
            <GraduationCap className="size-4" />
          </div>
          <span className="text-sm font-semibold text-foreground">PrepSensei</span>
        </Link>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            className="flex size-8 items-center justify-center rounded-full border border-white/50 dark:border-white/15 bg-white/40 dark:bg-white/10 text-foreground transition-all active:scale-95"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden animate-in fade-in-0 duration-200"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="fixed inset-y-3 left-3 w-72 rounded-[28px] liquid-glass-sidebar p-4 shadow-2xl animate-in slide-in-from-left duration-250 flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            {renderNavContent(false)}
          </div>
        </div>
      )}

      {/* Desktop Floating Left Liquid Glass Sidebar */}
      <aside
        aria-label="Sidebar navigation"
        className={cn(
          "hidden lg:flex fixed left-4 top-4 bottom-4 z-40 rounded-[28px] liquid-glass-sidebar flex-col justify-between shadow-2xl transition-all duration-300 ease-in-out",
          minimized ? "w-18 px-2 py-3" : "w-64 xl:w-72 p-3.5"
        )}
      >
        {renderNavContent(minimized)}
      </aside>

      {/* Floating Notifications & Updates Inspector Panel */}
      <NotificationPanel minimized={minimized} />
    </>
  )
}
