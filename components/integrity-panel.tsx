import { CheckCircle2, Eye, ShieldAlert, ShieldCheck } from "lucide-react"
import type { AssessmentSubmission, IntegrityResult, SimilarityResult } from "@/lib/demo-data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** Whether a human review is recommended for this submission's signals. */
export function reviewRequired(sub?: Pick<AssessmentSubmission, "integrity" | "similarity"> | null): boolean {
  if (!sub) return false
  return sub.integrity?.risk === "review" || sub.similarity?.reviewRecommended === true
}

/** Compact recruiter-facing badge for the Integrity Engine result. */
export function IntegrityBadge({
  integrity,
  flags,
}: {
  integrity?: IntegrityResult
  flags?: string[]
}) {
  if (flags && Array.isArray(flags)) {
    if (flags.length > 0) {
      return (
        <Badge variant="outline" className="text-warning border-warning/40">
          {flags.length} Flag{flags.length === 1 ? "" : "s"}
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-success border-success/40">
        Clean
      </Badge>
    )
  }

  if (!integrity) return <span className="text-xs text-muted-foreground">—</span>
  return integrity.risk === "review" ? (
    <Badge variant="outline" className="text-warning border-warning/40">
      Review Recommended
    </Badge>
  ) : (
    <Badge variant="outline" className="text-success border-success/40">
      Low Risk
    </Badge>
  )
}

/** Compact recruiter-facing badge for the Plagiarism / Similarity result. */
export function SimilarityBadge({
  similarity,
  status,
}: {
  similarity?: SimilarityResult
  status?: string
}) {
  const stat = status || similarity?.status
  if (!stat && !similarity) return <span className="text-xs text-muted-foreground">—</span>

  const isHigh = stat === "high"
  const isMod = stat === "moderate" || stat === "medium"
  const tone = isHigh
    ? "text-destructive border-destructive/40"
    : isMod
      ? "text-warning border-warning/40"
      : "text-success border-success/40"

  const pct = similarity?.overallSimilarity !== undefined ? `${similarity.overallSimilarity}% · ` : ""
  const label = isHigh ? "High" : isMod ? "Potential" : "Low"

  return (
    <Badge variant="outline" className={tone}>
      {pct}{label}
    </Badge>
  )
}

/** Review-recommendation badge derived from both engines or explicit status. */
export function ReviewBadge({
  submission,
  status,
}: {
  submission?: Pick<AssessmentSubmission, "integrity" | "similarity"> | null
  status?: string | null
}) {
  if (status) {
    if (status === "pending_review") {
      return (
        <Badge variant="outline" className="text-warning border-warning/40">
          <Eye className="size-3 mr-1" /> Pending
        </Badge>
      )
    }
    if (status === "flagged" || status === "review_required") {
      return (
        <Badge variant="outline" className="text-destructive border-destructive/40">
          <Eye className="size-3 mr-1" /> Required
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-success border-success/40">
        Clean
      </Badge>
    )
  }

  if (!submission || (!submission.integrity && !submission.similarity)) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return reviewRequired(submission) ? (
    <Badge variant="outline" className="text-warning border-warning/40">
      <Eye className="size-3 mr-1" /> Required
    </Badge>
  ) : (
    <Badge variant="outline" className="text-success border-success/40">
      Not required
    </Badge>
  )
}

/**
 * Full recruiter-only panel. Shows the deterministic signals from both engines,
 * worded as evidence for human review — never as proof of cheating/plagiarism.
 */
export function IntegrityReviewPanel({
  integrity,
  similarity,
}: {
  integrity?: IntegrityResult
  similarity?: SimilarityResult
}) {
  if (!integrity && !similarity) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {integrity && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {integrity.risk === "review" ? (
                  <ShieldAlert className="size-4 text-warning" />
                ) : (
                  <ShieldCheck className="size-4 text-success" />
                )}
                Integrity — {integrity.status}
              </CardTitle>
              <IntegrityBadge integrity={integrity} />
            </div>
            <CardDescription className="text-pretty">{integrity.explanation}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {integrity.signals.map((s, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                {s.kind === "watch" ? (
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                ) : (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-xs text-muted-foreground text-pretty">{s.detail}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {similarity && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Similarity — {similarity.overallSimilarity}%</CardTitle>
              <SimilarityBadge similarity={similarity} />
            </div>
            <CardDescription className="text-pretty">{similarity.explanation}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {similarity.matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No per-question overlap was measured.</p>
            ) : (
              similarity.matches.map((m) => (
                <div key={m.questionId} className="flex items-start justify-between gap-3 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{m.skill}</span>
                    <span className="text-xs text-muted-foreground text-pretty">
                      {m.note}
                      {m.matchedCandidate ? ` Closest to ${m.matchedCandidate}.` : ""}
                    </span>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{m.similarity}%</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
