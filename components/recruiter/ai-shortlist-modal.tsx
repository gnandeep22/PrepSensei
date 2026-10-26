"use client"

import { useState } from "react"
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ShortlistReport } from "@/app/api/recruiter/shortlist-agent/route"

interface AiShortlistModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: ShortlistReport | null
  loading: boolean
  onApplyDecisions?: (decisions: Array<{ applicationId: string; status: "shortlisted" | "advanced" | "rejected"; note?: string }>) => Promise<void>
}

export function AiShortlistModal({
  open,
  onOpenChange,
  report,
  loading,
  onApplyDecisions,
}: AiShortlistModalProps) {
  const [applying, setApplying] = useState(false)
  const [appliedSuccess, setAppliedSuccess] = useState(false)

  if (!open) return null

  async function handleApplyAll() {
    if (!report || !onApplyDecisions) return
    setApplying(true)
    try {
      const decisions = report.ranking.map((r) => ({
        applicationId: r.applicationId,
        status: (r.recommendedAction === "advance"
          ? "advanced"
          : r.recommendedAction === "shortlist"
          ? "shortlisted"
          : "rejected") as "shortlisted" | "advanced" | "rejected",
        note: r.comparativeAdvantage || r.summary,
      }))
      await onApplyDecisions(decisions)
      setAppliedSuccess(true)
    } catch (e) {
      console.error("Apply decisions error:", e)
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  AI RAG Resume Shortlisting &amp; Comparative Report
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {report ? `${report.jobTitle} at ${report.company} · ${report.totalApplicants} applicants evaluated` : "Analyzing applicant resumes..."}
                </DialogDescription>
              </div>
            </div>
            {report && (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs gap-1 py-1">
                <ShieldCheck className="size-3.5" /> Self-Validated Grounding Active
              </Badge>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <Loader2 className="size-10 animate-spin text-primary" />
            <div>
              <p className="font-semibold text-foreground">Running RAG Shortlisting Agent…</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Retrieving candidate resumes, verifying technical claims against JD requirements, and calculating comparative rankings.
              </p>
            </div>
          </div>
        ) : !report ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No report available. Please run the shortlisting agent on this job.
          </div>
        ) : (
          <div className="flex flex-col gap-5 pt-3">
            {appliedSuccess && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>
                    <strong>Shortlisting Decisions Dispatched!</strong> Official decision emails and candidate in-portal notifications have been sent.
                  </span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} className="h-7 text-xs">
                  Close
                </Button>
              </div>
            )}

            {/* Why Top Candidate Chosen Box */}
            <div className="glass-panel rounded-xl border-primary/30 bg-primary/[0.04] p-4 shadow-2xs">
              <div className="flex items-center gap-2 mb-2">
                <Award className="size-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground">
                  Why the Top Candidate Was Selected (Target Quota: {report.targetShortlistCount})
                </h4>
              </div>
              <p className="text-xs leading-relaxed text-foreground/90 font-medium">
                {report.whyTopCandidateChosen}
              </p>
              <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                <span className="flex items-center gap-1">
                  <Users className="size-3 text-primary" /> {report.totalApplicants} Total Candidates
                </span>
                <span className="flex items-center gap-1">
                  <UserCheck className="size-3 text-emerald-500" /> {report.ranking.filter((r) => r.recommendedAction === "advance" || r.recommendedAction === "shortlist").length} Selected
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-3 text-emerald-500" /> Resume citations audited
                </span>
              </div>
            </div>

            {/* Candidate Rankings */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ranked Applicant Pool &amp; Evidence Citations
              </h4>

              <div className="flex flex-col gap-3">
                {report.ranking.map((c) => {
                  const isTop = c.rank <= report.targetShortlistCount
                  return (
                    <Card
                      key={c.applicationId}
                      className={`overflow-hidden transition-all ${
                        isTop ? "border-primary/50 shadow-xs bg-primary/[0.01]" : "border-border/60 opacity-95"
                      }`}
                    >
                      <CardContent className="p-4 flex flex-col gap-3">
                        {/* Header row */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                                isTop
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              #{c.rank}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">{c.candidateName}</span>
                                <Badge
                                  variant={isTop ? "default" : "outline"}
                                  className={`text-[10px] py-0 ${
                                    c.recommendedAction === "advance"
                                      ? "bg-emerald-600 text-white"
                                      : c.recommendedAction === "shortlist"
                                      ? "bg-blue-600 text-white"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {c.recommendedAction === "advance"
                                    ? "Advance to Interview"
                                    : c.recommendedAction === "shortlist"
                                    ? "Shortlisted"
                                    : "Not Shortlisted"}
                                </Badge>
                              </div>
                              <span className="text-[11px] text-muted-foreground">{c.candidateEmail}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <span className="text-xs font-bold tabular-nums text-foreground">{c.score}%</span>
                              <span className="text-[10px] text-muted-foreground block">RAG Alignment</span>
                            </div>
                          </div>
                        </div>

                        {/* Comparative summary */}
                        <p className="text-xs text-muted-foreground leading-relaxed pl-8">
                          <strong className="text-foreground">Analysis: </strong>
                          {c.comparativeAdvantage || c.summary}
                        </p>

                        {/* Verified Strengths with Citations */}
                        {c.verifiedStrengths.length > 0 && (
                          <div className="pl-8 flex flex-col gap-1.5 pt-1">
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="size-3" /> Grounded Strengths in Resume:
                            </span>
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              {c.verifiedStrengths.map((s, idx) => (
                                <div key={idx} className="rounded bg-muted/40 p-2 text-[11px] border border-border/40">
                                  <div className="font-semibold text-foreground">{s.skill}</div>
                                  <p className="text-muted-foreground italic mt-0.5">&ldquo;{s.resumeEvidenceQuote}&rdquo;</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Critical Gaps */}
                        {c.criticalGaps.length > 0 && (
                          <div className="pl-8 flex flex-col gap-1.5">
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="size-3" /> Identified Missing Requirements:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {c.criticalGaps.map((g, idx) => (
                                <span key={idx} className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                                  {g.requirement}: {g.standingInResume}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Self validation certificate */}
                        {c.selfValidation && (
                          <div className="pl-8 text-[10px] text-muted-foreground flex items-center gap-1">
                            <ShieldCheck className="size-3 text-emerald-500" />
                            <span>{c.selfValidation.auditNotes}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Recruiter Strategy Advice */}
            {report.recruiterRecommendationNotes && (
              <div className="rounded-lg bg-muted/40 p-3.5 text-xs text-muted-foreground border border-border/50">
                <span className="font-semibold text-foreground">Hiring Partner Recommendation: </span>
                {report.recruiterRecommendationNotes}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/60">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={handleApplyAll}
                disabled={applying || appliedSuccess}
                className="gap-1.5"
              >
                {applying ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                {applying ? "Dispatching Announcements…" : "Apply AI Decisions & Notify Candidates"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
