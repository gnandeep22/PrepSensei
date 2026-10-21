"use client"

import React, { useEffect, useState } from "react"
import { Sun, Moon, Monitor } from "lucide-react"
import { useTheme, type Theme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        className={cn(
          "size-9 rounded-full border border-border/40 bg-background/50 backdrop-blur-md opacity-60",
          className
        )}
      />
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative flex size-8 sm:size-8.5 items-center justify-center rounded-full border border-white/50 dark:border-white/15 bg-white/40 dark:bg-white/[0.06] backdrop-blur-xl text-foreground/85 shadow-xs transition-all duration-150 hover:scale-105 hover:bg-white/70 dark:hover:bg-white/15 hover:text-foreground active:scale-95 cursor-pointer overflow-hidden",
        isDark ? "shadow-[0_0_12px_rgba(255,255,255,0.06)]" : "shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
        className
      )}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <div className="pointer-events-none absolute inset-x-1.5 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent" />
      {isDark ? (
        <Sun className="size-4 text-amber-300 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="size-4 text-slate-700 dark:text-slate-300 transition-transform duration-300 -rotate-12 hover:rotate-0" />
      )}
    </button>
  )
}

export function ThemeSegmentedControl({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className={cn("h-8 w-28 rounded-full bg-muted/40", className)} />
  }

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ]

  return (
    <div
      role="radiogroup"
      aria-label="Theme selection"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border/50 bg-secondary/60 p-1 backdrop-blur-md",
        className
      )}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-95",
              active
                ? "bg-background text-foreground shadow-xs border border-border/40 font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={`Select ${label} theme`}
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
