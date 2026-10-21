"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export type Theme = "system" | "light" | "dark"

interface ThemeContextType {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = "prepsensei_theme"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme) || "dark"
    setThemeState(stored)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const applyTheme = (currentTheme: Theme) => {
      let resolved: "light" | "dark"
      if (currentTheme === "system") {
        resolved = mediaQuery.matches ? "dark" : "light"
      } else {
        resolved = currentTheme
      }

      setResolvedTheme(resolved)

      if (resolved === "dark") {
        root.classList.add("dark")
        root.classList.remove("light")
        root.setAttribute("data-theme", "dark")
        root.style.colorScheme = "dark"
      } else {
        root.classList.add("light")
        root.classList.remove("dark")
        root.setAttribute("data-theme", "light")
        root.style.colorScheme = "light"
      }
    }

    applyTheme(theme)

    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system")
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme, mounted])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(STORAGE_KEY, newTheme)
    } catch {}
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    return {
      theme: "dark" as Theme,
      resolvedTheme: "dark" as "light" | "dark",
      setTheme: () => {},
    }
  }
  return context
}
