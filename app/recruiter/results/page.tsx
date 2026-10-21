"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import useSWR from "swr"
import { ArrowLeft, ChevronDown, ExternalLink, ShieldAlert, Trophy, Users } from "lucide-react"
import { useApp } from "@/lib/store"
import type { AssessmentSubmission, HiringDecision } from "@/lib/demo-data"
import { Field, Notice, PageHeader, StatCard, nativeSelectClass } from "@/components/shared"
import { AssessmentResultView, rankSubmissions } from "@/components/assessment-result"
import { DecisionBadge } from "@/components/hiring-decision"
import {
  IntegrityBadge,
  IntegrityReviewPanel,
  ReviewBadge,
  SimilarityBadge,
  reviewRequired,
} from "@/components/integrity-panel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function RecruiterResultsPage() {
  const { submissions, assessments, decisions } = useApp()

  const { data: subData } = useSWR(
    "/api/submissions",
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json()
    },
    { revalidateOnFocus: true }
  )

  const allSubmissions = useMemo(() => {
    const map = new Map<string, AssessmentSubmission>()
    for (const s of submissions) {
      if (!s.isPractice) map.set(s.id, s)
    }
    if (subData?.submissions && Array.isArray(subData.submissions)) {
      for (const s of subData.submissions) {
        if (!s.isPractice) map.set(s.id, s)
      }
    }
    return Array.from(map.values())
  }, [submissions, subData])

  const allDecisions = useMemo(() => {
    return { ...decisions, ...(subData?.decisions || {}) }
  }, [decisions, subData])

  // Assessments that actually have submissions, for the filter dropdown.
  const assessmentOptions = useMemo(() => {
    const ids = Array.from(new Set(allSubmissions.map((s) => s.assessmentId)))
    return ids.map((id) => {
      const sub = allSubmissions.find((s) => s.assessmentId === id)!
      return { id, title: sub.assessmentTitle, jobTitle: sub.jobTitle }
    })
  }, [allSubmissions])

  const [assessmentId, setAssessmentId] = useState<string>("all")

  const filtered = useMemo(
    () => (assessmentId === "all" ? allSubmissions : allSubmissions.filter((s) => s.assessmentId === assessmentId)),
    [allSubmissions, assessmentId],
  )
  const ranked = useMemo(() => rankSubmissions(filtered), [filtered])

  const pendingCount = filtered.filter((s) => s.result.reviewStatus === "pending_review").length
  const flaggedCount = filtered.filter((s) => reviewRequired(s)).length

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-300">
      <PageHeader
        title="Official Assessment & Interview Results"
        description="Interview-based ranking of candidates who qualified through resume shortlisting and completed their evaluation."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/recruiter/candidates" />}>
            <Users className="size-4" /> Resume Shortlisting
          </Button>
        }
      />

      <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-primary shrink-0" />
          <span>
            <strong className="text-foreground">Stage-Gated Recruiter Matrix: </strong>
            Showing official interview performance reports from candidates who qualified in resume shortlisting.
          </span>
        </div>
        <Badge variant="outline" className="border-primary/30 text-primary text-[10px] shrink-0 font-normal">
          Shortlisted &amp; Advanced Only
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Submissions" value={filtered.length} icon={<Users className="size-4" />} />
        <StatCard label="Assessments" value={assessmentOptions.length} icon={<Trophy className="size-4" />} />
        <StatCard label="Pending review" value={pendingCount} />
        <StatCard
          label="Review flagged"
          value={flaggedCount}
          hint="Integrity or similarity signal"
          icon={<ShieldAlert className="size-4" />}
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <Field label="Filter by assessment" htmlFor="assessment-filter">
            <select
              id="assessment-filter"
              className={nativeSelectClass}
              value={assessmentId}
              onChange={(e) => setAssessmentId(e.target.value)}
            >
              <option value="all">All assessments</option>
              {assessmentOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} — {a.jobTitle}
                </option>
              ))}
            </select>
          </Field>
        </CardContent>
      </Card>

      {ranked.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No submissions yet. When a candidate submits a published assessment, their result appears here.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Candidate ranking</CardTitle>
            <CardDescription>
              Ordered by overall assessment score. This is assessment-based ranking, not a guaranteed prediction of job
              performance. Candidates with answers awaiting review are marked clearly.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead className="hidden md:table-cell">Assessment</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="hidden sm:table-cell">Skills</TableHead>
                  <TableHead>Review status</TableHead>
                  <TableHead className="hidden lg:table-cell">Integrity</TableHead>
                  <TableHead className="hidden lg:table-cell">Similarity</TableHead>
                  <TableHead>Human review</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead className="w-24 text-right">Profile</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((sub, i) => (
                  <SubmissionRow key={sub.id} submission={sub} rank={i + 1} decision={allDecisions[sub.id]} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {assessments.length === 0 && (
        <Notice>Publish an assessment from the Assessment Builder to start collecting candidate submissions.</Notice>
      )}
    </div>
  )
}

function SubmissionRow({
  submission,
  rank,
  decision,
}: {
  submission: AssessmentSubmission
  rank: number
  decision?: HiringDecision
}) {
  const [open, setOpen] = useState(false)
  const { result } = submission
  const pending = result.reviewStatus === "pending_review"

  return (
    <>
      <TableRow>
        <TableCell className="tabular-nums text-muted-foreground">{rank}</TableCell>
        <TableCell className="font-medium">{submission.candidateName}</TableCell>
        <TableCell className="hidden text-muted-foreground md:table-cell">{submission.assessmentTitle}</TableCell>
        <TableCell>
          {result.overallScore === null ? (
            <Badge variant="outline" className="text-warning border-warning/40">
              Pending Review
            </Badge>
          ) : (
            <span className="font-semibold tabular-nums">{result.overallScore}%</span>
          )}
        </TableCell>
        <TableCell className="hidden sm:table-cell tabular-nums text-muted-foreground">
          {result.skillsEvaluated} / {result.skillResults.length}
        </TableCell>
        <TableCell>
          {pending ? (
            <Badge variant="outline" className="text-warning border-warning/40">
              {result.questionsRequiringReview} pending
            </Badge>
          ) : (
            <Badge variant="outline" className="text-success border-success/40">
              Complete
            </Badge>
          )}
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          <IntegrityBadge integrity={submission.integrity} />
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          <SimilarityBadge similarity={submission.similarity} />
        </TableCell>
        <TableCell>
          <ReviewBadge submission={submission} />
        </TableCell>
        <TableCell>
          <DecisionBadge decision={decision} />
        </TableCell>
        <TableCell className="text-right">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/recruiter/candidates/${submission.id}`} />}>
            <ExternalLink className="size-4" /> View
          </Button>
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Hide details" : "Show details"}
          >
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={12} className="bg-muted/30">
            {/* Recruiter sees the full breakdown including per-question scoring. */}
            <div className="flex flex-col gap-4 py-2">
              {(submission.integrity || submission.similarity) && (
                <IntegrityReviewPanel integrity={submission.integrity} similarity={submission.similarity} />
              )}
              <AssessmentResultView result={result} showAnswers />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
