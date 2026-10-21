"use client"

import Link from "next/link"
import { use, useMemo } from "react"
import { ArrowLeft, ClipboardCheck, Loader2, MessagesSquare, Sparkles } from "lucide-react"
import { useApp } from "@/lib/store"
import { recommendCandidate, type RecommendationTier } from "@/lib/interview/recommendation"
import { MatchScore, PageHeader, SkillBar, StatCard } from "@/components/shared"
import { AssessmentResultView, skillTone } from "@/components/assessment-result"
import { IntegrityReviewPanel } from "@/components/integrity-panel"
import { DecisionBadge } from "@/components/hiring-decision"
import { HiringDecisionManager } from "@/components/recruiter/hiring-decision-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FaceAnalysisReport } from "@/components/face/face-analysis-report"
import type { InterviewFaceReport } from "@/lib/db/schema"
import useSWR from "swr"

/** Tier → visual tone for the recommendation banner. */
const tierStyles: Record<RecommendationTier, { badge: string; accent: string }> = {
  strong: { badge: "text-success border-success/40", accent: "border-success/40 bg-success/5" },
  consider: { badge: "text-primary border-primary/40", accent: "border-primary/30 bg-primary/5" },
  hold: { badge: "text-warning border-warning/40", accent: "border-warning/40 bg-warning/10" },
}

export default function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { submissions, decisions, setDecision } = useApp()

  const { data: subData, isLoading } = useSWR(
    "/api/submissions",
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json()
    },
    { revalidateOnFocus: true }
  )

  const allSubmissions = useMemo(() => {
    const map = new Map<string, any>()
    for (const s of submissions) map.set(s.id, s)
    if (subData?.submissions && Array.isArray(subData.submissions)) {
      for (const s of subData.submissions) map.set(s.id, s)
    }
    return Array.from(map.values())
  }, [submissions, subData])

  const submission = useMemo(() => allSubmissions.find((s) => s.id === id), [allSubmissions, id])

  if (!submission && isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading candidate profile and evaluation…</p>
      </div>
    )
  }

  if (!submission) {
    return (
      <>
        <PageHeader
          title="Candidate not found"
          description="This submission is no longer available. It may have been cleared from the in-memory store."
          actions={
            <Button variant="outline" nativeButton={false} render={<Link href="/recruiter/results" />}>
              <ArrowLeft className="size-4" /> Back to results
            </Button>
          }
        />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No candidate matches this link. Return to the results table and open a candidate from there.
          </CardContent>
        </Card>
      </>
    )
  }

  const { result, interview } = submission
  const recommendation = recommendCandidate(submission)
  const decision = decisions[submission.id] || subData?.decisions?.[submission.id]

  // Fetch face analysis report if available
  const { data: faceData } = useSWR(
    submission ? `/api/face/analysis?submissionId=${submission.id}` : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json()
    },
    { revalidateOnFocus: false }
  )
  const faceReport: InterviewFaceReport | null = faceData?.analyses?.[0]?.report ?? null
  const faceRegistration = faceData?.registration ?? null

  const styles = tierStyles[recommendation.tier]

  return (
    <>
      <PageHeader
        title={submission.candidateName}
        description={`${submission.assessmentTitle} · ${submission.jobTitle} at ${submission.company} · submitted ${submission.submittedAt}`}
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/recruiter/results" />}>
            <ArrowLeft className="size-4" /> Back to results
          </Button>
        }
      />

      {/* Recommendation banner — decision support, not an automated verdict. */}
      <Card className={styles.accent}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Recommendation
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={styles.badge}>
                {recommendation.label}
              </Badge>
              <DecisionBadge decision={decision} />
            </div>
          </div>
          <CardDescription className="text-pretty">
            Deterministic decision support that blends assessment and interview signals. It is not a guaranteed
            prediction of job performance — the hiring decision is always yours.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <MatchScore score={recommendation.blended ?? 0} size="lg" label="blended" />
          <ul className="flex flex-1 flex-col gap-2">
            {recommendation.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-pretty">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                {reason}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Hiring decision & Email Dispatch */}
      <HiringDecisionManager
        submissionId={submission.id}
        candidateUserId={submission.candidateUserId}
        candidateName={submission.candidateName}
        candidateEmail={submission.answers?.email || undefined}
        jobTitle={submission.jobTitle}
        company={submission.company}
        overallScore={interview?.overall ?? result.overallScore ?? undefined}
        currentStatus={decision?.status}
        onDecisionSubmitted={(status, note) => setDecision(submission.id, status, note)}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Assessment"
          value={result.overallScore === null ? "Pending" : `${result.overallScore}%`}
          icon={<ClipboardCheck className="size-4" />}
        />
        <StatCard label="Interview" value={interview ? `${interview.overall}%` : "—"} icon={<MessagesSquare className="size-4" />} />
        <StatCard label="Skills evaluated" value={`${result.skillsEvaluated} / ${result.skillResults.length}`} />
        <StatCard label="Requiring review" value={result.questionsRequiringReview} />
      </div>

      {/* Interview evaluation bridge — the two halves of the platform meet here. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessagesSquare className="size-4 text-primary" /> Interview evaluation
          </CardTitle>
          <CardDescription>
            {interview
              ? "Results from the candidate's AI interview, shown alongside the assessment for a complete picture."
              : "This candidate has not completed an AI interview yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {interview ? (
            <div className="flex flex-col gap-5 sm:flex-row">
              <MatchScore score={interview.overall} size="md" label="interview" />
              <div className="flex flex-1 flex-col gap-4">
                {interview.breakdown.map((b: any) => (
                  <SkillBar key={b.label} label={b.label} value={b.score} tone={skillTone(b.score)} />
                ))}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Strengths</p>
                    <ul className="flex flex-col gap-1 text-sm">
                      {interview.strengths.map((s: string) => (
                        <li key={s} className="text-pretty">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Areas to improve
                    </p>
                    <ul className="flex flex-col gap-1 text-sm">
                      {interview.improvements.map((s: string) => (
                        <li key={s} className="text-pretty">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No interview on file. Invite the candidate to complete an AI interview to enrich this profile.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Integrity + similarity evidence — for human review, never proof. */}
      {(submission.integrity || submission.similarity) && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Integrity &amp; similarity evidence</h2>
          <IntegrityReviewPanel integrity={submission.integrity} similarity={submission.similarity} />
        </div>
      )}

      {/* Face analysis report — behavioral observations for human review */}
      {faceReport && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Face analysis report</h2>
          <FaceAnalysisReport
            report={faceReport}
            registration={faceRegistration}
            candidateName={submission.candidateName}
          />
        </div>
      )}

      {/* Full assessment breakdown, including per-question scoring. */}
      <AssessmentResultView result={result} showAnswers />
    </>
  )
}
