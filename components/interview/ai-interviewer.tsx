"use client"

import { Bot, Ear, Loader2, Volume2, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type AiState = "idle" | "speaking" | "listening" | "thinking"

const stateMeta: Record<AiState, { label: string; icon: typeof Bot; tone: string }> = {
  idle: { label: "Ready", icon: Bot, tone: "text-muted-foreground" },
  speaking: { label: "Speaking", icon: Volume2, tone: "text-primary" },
  listening: { label: "Listening", icon: Ear, tone: "text-success" },
  thinking: { label: "Analyzing your response", icon: Loader2, tone: "text-warning" },
}

/**
 * The AI interviewer "video tile". Reflects the agent's live speaking/listening status
 * with wave animation and provides a direct voice playback button.
 */
export function AiInterviewer({
  state,
  question,
  statusText,
  name = "AI Interviewer",
  onReplay,
}: {
  state: AiState
  question?: string
  statusText?: string
  name?: string
  onReplay?: () => void
}) {
  const meta = stateMeta[state]
  const Icon = meta.icon
  const speaking = state === "speaking"
  const listening = state === "listening"
  const thinking = state === "thinking"

  const displayText = question || statusText || (thinking ? "Analyzing your response…" : "Preparing your interview…")

  return (
    <div className="glass-panel relative flex aspect-video w-full flex-col justify-between overflow-hidden rounded-2xl border-border/80 bg-background/25 p-3 sm:p-4 shadow-sm transition-all duration-300">
      {/* Ambient background glow when speaking or listening */}
      {speaking && (
        <div className="pointer-events-none absolute -top-12 -left-12 size-48 rounded-full bg-primary/15 blur-3xl animate-pulse" />
      )}
      {listening && (
        <div className="pointer-events-none absolute -top-12 -right-12 size-48 rounded-full bg-emerald-500/15 blur-3xl animate-pulse" />
      )}

      {/* State badge & controls header */}
      <div className="flex items-center justify-between w-full shrink-0 z-10 gap-2">
        <div className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur shadow-xs transition-colors duration-300",
          speaking
            ? "border-primary/50 bg-primary/10 text-primary"
            : listening
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : thinking
                ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border bg-card/80 text-muted-foreground"
        )}>
          <Icon className={cn("size-3.5", meta.tone, thinking && "animate-spin")} />
          <span className={meta.tone}>{meta.label}</span>
        </div>

        <div className="flex items-center gap-2">
          {onReplay && question && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onReplay}
              className="h-7 gap-1.5 rounded-full border border-border/70 bg-card/80 px-2.5 text-xs font-medium text-foreground hover:bg-card hover:scale-105 transition-transform backdrop-blur shadow-xs"
              title="Listen to question again"
            >
              {speaking ? <Volume2 className="size-3.5 text-primary animate-pulse" /> : <Play className="size-3 text-muted-foreground" />}
              {speaking ? "Speaking…" : "Hear question"}
            </Button>
          )}
          <div className="rounded-full border border-border/70 bg-card/80 px-2.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur shadow-xs">
            {name}
          </div>
        </div>
      </div>

      {/* Centered Avatar, Waves, and Question Body */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 overflow-hidden my-auto z-10">
        <div className="relative flex items-center justify-center shrink-0">
          {/* Radar ring pulse during active speech / listening */}
          {(speaking || listening) && (
            <div
              className={cn(
                "absolute size-14 rounded-full animate-radar-ring pointer-events-none",
                speaking ? "border-2 border-primary/40 bg-primary/10" : "border-2 border-emerald-500/40 bg-emerald-500/10"
              )}
            />
          )}

          <div
            className={cn(
              "relative flex size-12 sm:size-14 items-center justify-center rounded-full border-2 transition-all duration-300 shadow-md",
              speaking
                ? "border-primary bg-primary/15 text-primary ring-4 ring-primary/20 scale-105"
                : listening
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-500 ring-4 ring-emerald-500/20 scale-105"
                  : thinking
                    ? "border-amber-500 bg-amber-500/15 text-amber-500 ring-4 ring-amber-500/20"
                    : "border-border/80 bg-card text-muted-foreground hover:border-border",
            )}
          >
            <Bot className="size-6 sm:size-7 transition-transform duration-300" />
          </div>
        </div>

        {/* Live soundwave equalizer when AI is speaking or listening */}
        {speaking && (
          <div className="flex items-center justify-center gap-1 h-4">
            <span className="w-1 rounded-full bg-primary animate-soundwave-1" />
            <span className="w-1 rounded-full bg-primary animate-soundwave-2" />
            <span className="w-1 rounded-full bg-primary animate-soundwave-3" />
            <span className="w-1 rounded-full bg-primary animate-soundwave-4" />
            <span className="w-1 rounded-full bg-primary animate-soundwave-5" />
          </div>
        )}
        {listening && (
          <div className="flex items-center justify-center gap-1 h-4">
            <span className="w-1 rounded-full bg-emerald-500 animate-soundwave-2" />
            <span className="w-1 rounded-full bg-emerald-500 animate-soundwave-3" />
            <span className="w-1 rounded-full bg-emerald-500 animate-soundwave-1" />
          </div>
        )}

        {/* Scrollable question caption */}
        <div className="w-full max-h-[105px] sm:max-h-[125px] overflow-y-auto px-2 text-center scrollbar-thin">
          <p className="text-pretty text-xs sm:text-sm font-medium leading-relaxed text-foreground tracking-tight">
            {displayText}
          </p>
        </div>
      </div>
    </div>
  )
}
