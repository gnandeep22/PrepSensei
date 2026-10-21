"use client"

import { useState } from "react"
import { CheckCircle2, ChevronsUp, RotateCcw, Star, XCircle } from "lucide-react"
import type { HiringDecision, HiringDecisionStatus } from "@/lib/demo-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/** Human-readable label + tone for each decision status. */
const decisionMeta: Record<
  Exclude<HiringDecisionStatus, "undecided">,
  { label: string; className: string }
> = {
  shortlisted: { label: "Shortlisted", className: "text-primary border-primary/40" },
  advanced: { label: "Advanced", className: "text-success border-success/40" },
  rejected: { label: "Rejected", className: "text-destructive border-destructive/40" },
}

/** Compact badge showing the current recruiter decision (or an em dash). */
export function DecisionBadge({
  decision,
  status,
  decidedAt,
}: {
  decision?: HiringDecision
  status?: any
  decidedAt?: string
}) {
  const currentStatus = decision?.status || status
  if (!currentStatus || currentStatus === "undecided") {
    return <span className="text-xs text-muted-foreground">Undecided</span>
  }
  const meta = decisionMeta[currentStatus as Exclude<HiringDecisionStatus, "undecided">]
  if (!meta) {
    return <span className="text-xs text-muted-foreground capitalize">{String(currentStatus)}</span>
  }
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  )
}

/**
 * Recruiter decision controls. The decision is human-owned: these buttons only
 * write what the recruiter explicitly chooses and can always be cleared.
 */
export function DecisionControls({
  decision,
  onDecide,
}: {
  decision?: HiringDecision
  onDecide: (status: HiringDecisionStatus, note?: string) => void
}) {
  const [note, setNote] = useState(decision?.note ?? "")
  const current = decision?.status ?? "undecided"

  const buttons: { status: Exclude<HiringDecisionStatus, "undecided">; label: string; icon: typeof Star }[] = [
    { status: "shortlisted", label: "Shortlist", icon: Star },
    { status: "advanced", label: "Advance", icon: ChevronsUp },
    { status: "rejected", label: "Reject", icon: XCircle },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {buttons.map(({ status, label, icon: Icon }) => {
          const active = current === status
          return (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => onDecide(status, note.trim() || undefined)}
              aria-pressed={active}
            >
              <Icon className="size-4" /> {label}
            </Button>
          )
        })}
        {current !== "undecided" && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onDecide("undecided")}>
            <RotateCcw className="size-4" /> Clear
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="decision-note" className="text-xs font-medium text-muted-foreground">
          Decision note (optional)
        </label>
        <textarea
          id="decision-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            // Persist an edited note against an existing decision without changing status.
            if (current !== "undecided") onDecide(current, note.trim() || undefined)
          }}
          rows={2}
          placeholder="Add context for this decision — visible to your team."
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {decision && decision.status !== "undecided" && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-success" />
          Recorded {new Date(decision.decidedAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}
