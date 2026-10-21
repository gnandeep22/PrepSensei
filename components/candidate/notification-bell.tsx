"use client"

import React, { useEffect, useState, useRef, createContext, useContext } from "react"
import Link from "next/link"
import { Bell, CheckCheck, Sparkles, X, Rocket, Briefcase, ExternalLink, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type CandidateNotificationItem = {
  id: string
  title: string
  message: string
  type: "shortlisted" | "advanced" | "rejected" | "info"
  jobTitle?: string | null
  company?: string | null
  read: boolean
  createdAt: string
}

interface NotificationContextType {
  notifications: CandidateNotificationItem[]
  unreadCount: number
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  toggleOpen: () => void
  markAllAsRead: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  loading: boolean
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<CandidateNotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/candidate/notifications")
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (err) {
      console.error("Failed to load notifications:", err)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 12000)
    return () => clearInterval(interval)
  }, [])

  const markAllAsRead = async () => {
    try {
      setLoading(true)
      await fetch("/api/candidate/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/candidate/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isOpen,
        setIsOpen,
        toggleOpen: () => setIsOpen((prev) => !prev),
        markAllAsRead,
        markAsRead,
        loading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    // Graceful fallback if used outside provider
    return {
      notifications: [],
      unreadCount: 0,
      isOpen: false,
      setIsOpen: () => {},
      toggleOpen: () => {},
      markAllAsRead: async () => {},
      markAsRead: async () => {},
      loading: false,
    }
  }
  return ctx
}

export function NotificationBell({
  side = "bottom",
  className,
}: {
  side?: "top" | "bottom"
  className?: string
} = {}) {
  const { unreadCount, isOpen, toggleOpen } = useNotifications()

  return (
    <div className="relative inline-flex items-center justify-center">
      <button
        type="button"
        onClick={toggleOpen}
        title={unreadCount > 0 ? `${unreadCount} unread notifications & updates` : "Notifications & Updates"}
        aria-label="View notifications and updates"
        className={cn(
          "relative flex size-8.5 items-center justify-center rounded-xl border transition-all duration-200 active:scale-95 cursor-pointer",
          unreadCount > 0
            ? "border-primary/40 bg-primary/10 text-primary shadow-xs hover:bg-primary/15"
            : "border-white/50 dark:border-white/15 bg-white/50 dark:bg-white/[0.06] text-foreground/80 hover:text-foreground hover:bg-white/80 dark:hover:bg-white/12",
          isOpen && "ring-2 ring-primary/50 bg-primary/15 text-primary",
          className
        )}
      >
        <Bell className="size-4 stroke-[2]" />

        {/* Floating unclipped unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex min-w-4.5 h-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(244,63,94,0.6)] ring-2 ring-background animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}

export function NotificationPanel({
  minimized = false,
}: {
  minimized?: boolean
}) {
  const { notifications, unreadCount, isOpen, setIsOpen, markAllAsRead, markAsRead, loading } = useNotifications()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Only close if not clicking a toggle button
        const target = e.target as HTMLElement
        if (!target.closest("[data-notif-trigger]")) {
          setIsOpen(false)
        }
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs lg:hidden animate-in fade-in-0 duration-200"
        onClick={() => setIsOpen(false)}
      />

      {/* Flyout Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed z-50 rounded-3xl bg-card/98 dark:bg-zinc-900/98 backdrop-blur-2xl border border-border/80 shadow-2xl overflow-hidden flex flex-col select-none",
          // Mobile Positioning: centered below top mobile header
          "inset-x-4 top-18 max-h-[80vh] mx-auto max-w-md animate-in fade-in-0 zoom-in-95 duration-200",
          // Desktop Positioning: anchored right next to the left sidebar with spatial depth
          minimized
            ? "lg:inset-auto lg:left-24 lg:top-4 lg:bottom-4 lg:w-[410px] lg:max-h-none lg:animate-in lg:slide-in-from-left-4 lg:fade-in-0 duration-200"
            : "lg:inset-auto lg:left-72 xl:left-80 lg:top-4 lg:bottom-4 lg:w-[420px] lg:max-h-none lg:animate-in lg:slide-in-from-left-4 lg:fade-in-0 duration-200"
        )}
      >
        {/* Specular Top Glow Line */}
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/25 to-transparent" />

        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3.5 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Bell className="size-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-foreground">
                  Notifications &amp; Updates
                </span>
                {unreadCount > 0 && (
                  <Badge variant="default" className="bg-rose-500 text-white text-[10px] py-0 px-1.5 font-bold">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground">
                Live recruitment &amp; application status
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
                onClick={markAllAsRead}
                disabled={loading}
              >
                <CheckCheck className="size-3.5 mr-1 text-primary" /> Mark all read
              </Button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Notifications Scroll List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/50 p-2 space-y-1.5">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-xs text-muted-foreground px-6">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/50 border border-border/60 text-muted-foreground/60 mb-3">
                <Bell className="size-7" />
              </div>
              <p className="font-semibold text-sm text-foreground">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-xs">
                When recruiters shortlist your profile, advance you to interviews, or send hiring decisions, updates will appear here in real-time.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const isShortlist = n.type === "shortlisted"
              const isAdvance = n.type === "advanced"
              const isReject = n.type === "rejected"

              // Extract any link from message like /interview/official?...
              const linkMatch = n.message.match(/\/interview\/official\?[^\s]+/i)
              const interviewLink = linkMatch ? linkMatch[0] : null
              const cleanMessage = interviewLink
                ? n.message.replace(/Take your official interview:.*$/i, "").trim()
                : n.message

              return (
                <div
                  key={n.id}
                  onClick={() => !n.read && markAsRead(n.id)}
                  className={cn(
                    "flex flex-col gap-2 p-3.5 rounded-2xl transition-all duration-150 cursor-pointer border text-left",
                    !n.read
                      ? "bg-primary/[0.04] dark:bg-primary/[0.07] border-primary/30 shadow-xs hover:border-primary/50"
                      : "bg-card hover:bg-muted/40 border-border/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isAdvance ? (
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          <Rocket className="size-3.5" />
                        </div>
                      ) : isShortlist ? (
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          <Sparkles className="size-3.5" />
                        </div>
                      ) : (
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Briefcase className="size-3.5" />
                        </div>
                      )}
                      <span className="text-xs font-bold leading-snug text-foreground">
                        {n.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(n.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                      {!n.read && (
                        <span className="size-2 rounded-full bg-rose-500 shrink-0" />
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-foreground/80 leading-relaxed font-normal">
                    {cleanMessage}
                  </p>

                  {/* Company & Job pill + Quick action if interview link exists */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/30">
                    {n.company && (
                      <span className="text-[11px] font-semibold text-primary/90 flex items-center gap-1">
                        <Briefcase className="size-3" />
                        {n.company} {n.jobTitle ? `· ${n.jobTitle}` : ""}
                      </span>
                    )}

                    {interviewLink && (
                      <Link
                        href={interviewLink}
                        onClick={() => {
                          if (!n.read) markAsRead(n.id)
                          setIsOpen(false)
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                      >
                        Take Interview <ArrowRight className="size-3" />
                      </Link>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
