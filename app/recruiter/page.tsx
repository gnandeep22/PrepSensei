"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import useSWR from "swr"
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Eye,
  Mail,
  Plus,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { PageHeader, StatCard } from "@/components/shared"
import { rankSubmissions } from "@/components/assessment-result"
import { IntegrityBadge, ReviewBadge, SimilarityBadge, reviewRequired } from "@/components/integrity-panel"
import { DecisionBadge } from "@/components/hiring-decision"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AgenticJobCreator } from "@/components/recruiter/agentic-job-creator"
import { HiringDecisionModal } from "@/components/recruiter/hiring-decision-modal"
import type { Assessment, AssessmentSubmission } from "@/lib/demo-data"

export default function RecruiterOverviewPage() {
  const { assessments, submissions, decisions, saveAssessment } = useApp()
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedSubmission, setSelectedSubmission] = useState<AssessmentSubmission | null>(null)

  // Real-time synchronization with Neon PostgreSQL
  const { data: assessData, mutate: refreshAssessments } = useSWR(
    "/api/assessment",
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json()
    },
    { revalidateOnFocus: true }
  )

  const { data: subData, mutate: refreshSubmissions } = useSWR(
    "/api/submissions",
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json()
    },
    { revalidateOnFocus: true }
  )

  const allAssessments = useMemo(() => {
    const map = new Map<string, Assessment>()
    for (const a of assessments) map.set(a.id, a)
    if (assessData?.assessments && Array.isArray(assessData.assessments)) {
      for (const a of assessData.assessments) map.set(a.id, a)
    }
    return Array.from(map.values())
  }, [assessments, assessData])

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

  const published = useMemo(() => allAssessments.filter((a) => a.status === "published"), [allAssessments])

  const activeJobs = useMemo(() => {
    const byJob = new Map<string, { jobId: string; jobTitle: string; company: string; assessments: number; applicants: number }>()
    for (const a of published) {
      const entry = byJob.get(a.jobId) ?? {
        jobId: a.jobId,
        jobTitle: a.jobTitle,
        company: a.company,
        assessments: 0,
        applicants: 0,
      }
      entry.assessments += 1
      byJob.set(a.jobId, entry)
    }
    for (const s of allSubmissions) {
      const entry = byJob.get(s.jobId)
      if (entry) entry.applicants += 1
    }
    return Array.from(byJob.values())
  }, [published, allSubmissions])

  const ranked = useMemo(() => rankSubmissions(allSubmissions), [allSubmissions])
  const flaggedCount = useMemo(() => allSubmissions.filter((s) => reviewRequired(s)).length, [allSubmissions])
  const pendingCount = useMemo(
    () => allSubmissions.filter((s) => s.result.reviewStatus === "pending_review").length,
    [allSubmissions],
  )

  const handleJobPublished = (result: any, draft?: any) => {
    refreshAssessments()
    if (draft && result.jobId) {
      saveAssessment({
        id: result.assessmentId,
        title: `${draft.title} Technical Screening`,
        jobId: result.jobId,
        jobTitle: draft.title,
        company: draft.company || "Hiring Partner",
        difficulty: "Medium",
        status: "published",
        questions: (draft.interviewQuestions || []).map((q: any, idx: number) => ({
          id: `q-${idx + 1}`,
          type: "short" as const,
          skill: q.skill || "Technical",
          difficulty: "Medium" as const,
          question: q.question,
          options: [],
          correctIndex: 0,
          explanation: "",
          keyPoints: q.keyPoints || [],
        })),
        createdAt: new Date().toISOString(),
      })
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-300">
      <PageHeader
        title="Recruiter Portal"
        description="Executive hiring dashboard. Build roles with AI agents, manage job postings, and review verified candidate interview reports."
        actions={
          <div className="flex items-center gap-2">
            <Button nativeButton={false} render={<Link href="/recruiter/job-creator" />}>
              <Sparkles className="size-4" /> Agentic JD Creator
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/recruiter/results" />}>
              <BarChart3 className="size-4" /> Interview Results
            </Button>
          </div>
        }
      />

      {/* Top Level Metric KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active roles"
          value={activeJobs.length}
          hint="Published job openings"
          icon={<Briefcase className="size-4" />}
        />
        <StatCard
          label="Published screenings"
          value={published.length}
          hint="AI technical interviews"
          icon={<ClipboardCheck className="size-4" />}
        />
        <StatCard
          label="Total applicants"
          value={allSubmissions.length}
          hint={`${pendingCount} awaiting review`}
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Proctoring alerts"
          value={flaggedCount}
          hint="Integrity & gaze flags"
          icon={<ShieldAlert className="size-4" />}
        />
      </div>

      {/* Clean Feature Tabs to prevent vertical clutter */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="job_creator" className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" /> Agentic JD
          </TabsTrigger>
          <TabsTrigger value="jobs">Job Postings</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW TAB: Clean summary, Quick Launch, and Recent Activity */}
        <TabsContent value="overview" className="mt-4 flex flex-col gap-6">
          {/* Feature Quick Launch Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="flex flex-col justify-between p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-xs hover:-translate-y-0.5">
              <div className="flex flex-col gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </div>
                <h4 className="font-semibold text-sm">Agentic JD Creator</h4>
                <p className="text-xs text-muted-foreground">
                   Create job descriptions and screening questions from a role brief.
                </p>
              </div>
              <Button size="sm" className="mt-4 w-full" nativeButton={false} render={<Link href="/recruiter/job-creator" />}>
                Launch Creator <ArrowRight className="size-3.5" />
              </Button>
            </Card>

            <Card className="flex flex-col justify-between p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-xs hover:-translate-y-0.5">
              <div className="flex flex-col gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Briefcase className="size-5" />
                </div>
                <h4 className="font-semibold text-sm">Job Postings</h4>
                <p className="text-xs text-muted-foreground">
                  View and manage all active positions and linked candidate interview assessments.
                </p>
              </div>
              <Button size="sm" variant="outline" className="mt-4 w-full" nativeButton={false} render={<Link href="/recruiter/jobs" />}>
                Manage Postings <ArrowRight className="size-3.5" />
              </Button>
            </Card>

            <Card className="flex flex-col justify-between p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-xs hover:-translate-y-0.5">
              <div className="flex flex-col gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="size-5" />
                </div>
                <h4 className="font-semibold text-sm">Candidate Pipeline</h4>
                <p className="text-xs text-muted-foreground">
                  Score rankings, biometric integrity reports, and 1-click email decision templates.
                </p>
              </div>
              <Button size="sm" variant="outline" className="mt-4 w-full" nativeButton={false} render={<Link href="/recruiter/candidates" />}>
                View Pipeline <ArrowRight className="size-3.5" />
              </Button>
            </Card>
          </div>

          {/* Recent Submissions Preview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Recent Candidate Submissions</CardTitle>
                <CardDescription>Latest candidate interview results and verified proctoring metrics.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/recruiter/candidates" />}>
                View all ({ranked.length}) <ArrowRight className="size-3.5 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {ranked.length === 0 ? (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  No candidate submissions yet. When candidates complete an AI interview, they will appear here.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Integrity</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranked.slice(0, 5).map((s) => {
                      const dec = allDecisions[s.id]
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-xs">{s.candidateName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.assessmentTitle}</TableCell>
                          <TableCell className="font-mono text-xs font-semibold">
                            {s.result.overallScore !== null ? `${s.result.overallScore}%` : "Flagged"}
                          </TableCell>
                          <TableCell>
                            <IntegrityBadge integrity={s.integrity} flags={(s.result as any)?.integrityFlags} />
                          </TableCell>
                          <TableCell>
                            {dec ? (
                              <DecisionBadge status={dec.status} decidedAt={dec.decidedAt} />
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">Pending</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setSelectedSubmission(s)}
                            >
                              <Mail className="size-3 mr-1" /> Decision
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. AGENTIC JD CREATOR TAB */}
        <TabsContent value="job_creator" className="mt-4">
          <div className="mx-auto max-w-4xl">
            <AgenticJobCreator onJobPublished={handleJobPublished} />
          </div>
        </TabsContent>

        {/* 3. ACTIVE JOBS TAB */}
        <TabsContent value="jobs" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {activeJobs.length === 0 ? (
              <p className="col-span-2 p-8 text-center text-xs text-muted-foreground">
                No active jobs published yet. Use the Agentic JD Creator tab to post a new job.
              </p>
            ) : (
              activeJobs.map((j) => (
                <Card key={j.jobId} className="flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{j.jobTitle}</CardTitle>
                        <CardDescription>{j.company}</CardDescription>
                      </div>
                      <Badge variant="default">Active</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span><strong>{j.applicants}</strong> applicant{j.applicants === 1 ? "" : "s"}</span>
                      <span><strong>{j.assessments}</strong> screening questionnaire{j.assessments === 1 ? "" : "s"}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-2 mt-2">
                      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/recruiter/candidates?job=${j.jobId}`} />}>
                        <Users className="size-3.5 mr-1" /> View Applicants
                      </Button>
                      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/interview?jobId=${j.jobId}`} />}>
                        <Eye className="size-3.5 mr-1" /> Test Interview Room
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* 4. CANDIDATES PIPELINE TAB */}
        <TabsContent value="candidates" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Candidate Leaderboard</CardTitle>
                  <CardDescription>Ranked by AI technical evaluation score and proctoring compliance.</CardDescription>
                </div>
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/recruiter/candidates" />}>
                  Open Full Candidate Page <ArrowRight className="size-3.5 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {ranked.length === 0 ? (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  No submissions yet. Candidates who complete interviews appear here.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Assessment Role</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Integrity</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranked.map((s, idx) => {
                      const dec = allDecisions[s.id]
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-xs">{s.candidateName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.assessmentTitle}</TableCell>
                          <TableCell className="font-mono text-xs font-semibold">
                            {s.result.overallScore !== null ? `${s.result.overallScore}%` : "Flagged"}
                          </TableCell>
                          <TableCell>
                            <IntegrityBadge integrity={s.integrity} flags={(s.result as any)?.integrityFlags} />
                          </TableCell>
                          <TableCell>
                            {dec ? (
                              <DecisionBadge status={dec.status} decidedAt={dec.decidedAt} />
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">Pending</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setSelectedSubmission(s)}
                            >
                              <Mail className="size-3 mr-1" /> Decision
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recruiter Hiring Decision Modal */}
      {selectedSubmission && (
        <HiringDecisionModal
          submission={selectedSubmission}
          open={Boolean(selectedSubmission)}
          onClose={() => setSelectedSubmission(null)}
          onDecisionSaved={() => {
            refreshSubmissions()
          }}
        />
      )}
    </div>
  )
}
