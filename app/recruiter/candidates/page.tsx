"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo, useState, useEffect } from "react"
import useSWR from "swr"
import {
  Users,
  Search,
  Eye,
  Mail,
  ShieldAlert,
  ArrowUpDown,
  Sparkles,
  BarChart3,
  ExternalLink,
  Award,
  CheckCircle2,
  FileText,
  Send,
  UserCheck,
  UserX,
  Briefcase,
  ChevronRight,
  SlidersHorizontal,
  Loader2,
  ShieldCheck,
  Clock,
  Phone,
  Globe,
  AlertTriangle,
} from "lucide-react"
import { PageHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { rankSubmissions } from "@/components/assessment-result"
import { IntegrityBadge, ReviewBadge, SimilarityBadge } from "@/components/integrity-panel"
import { DecisionBadge } from "@/components/hiring-decision"
import { HiringDecisionModal } from "@/components/recruiter/hiring-decision-modal"
import { AiShortlistModal } from "@/components/recruiter/ai-shortlist-modal"
import { useApp } from "@/lib/store"
import { demoJobs, type AssessmentSubmission, type Job } from "@/lib/demo-data"
import type { ShortlistReport } from "@/app/api/recruiter/shortlist-agent/route"

export default function CandidatePipelinePage() {
  const searchParams = useSearchParams()
  const initialJobId = searchParams.get("job")

  const { submissions, decisions, allJobs } = useApp()
  const [search, setSearch] = useState("")
  const [selectedSubmission, setSelectedSubmission] = useState<AssessmentSubmission | null>(null)
  const [activeTab, setActiveTab] = useState<"shortlisting" | "interviews">("shortlisting")

  // Fetch recruiter's posted jobs from database
  const { data: recruiterJobsData } = useSWR(
    "/api/recruiter/jobs",
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json()
    },
    { revalidateOnFocus: true }
  )

  // Target Roles: STRICTLY ONLY the roles posted by the recruiter
  const availableJobs: any[] = useMemo(() => {
    const list: any[] = []
    const seen = new Set<string>()

    if (recruiterJobsData?.jobs && Array.isArray(recruiterJobsData.jobs)) {
      for (const j of recruiterJobsData.jobs) {
        if (!seen.has(j.id)) {
          seen.add(j.id)
          list.push(j)
        }
      }
    }

    if (allJobs && Array.isArray(allJobs)) {
      for (const j of allJobs) {
        if (
          (j.id.startsWith("recruiter-job-") || (j as any).source === "recruiter") &&
          !seen.has(j.id)
        ) {
          seen.add(j.id)
          list.push(j)
        }
      }
    }

    return list
  }, [recruiterJobsData, allJobs])

  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId || "")

  // Auto-select first posted job when loaded
  useEffect(() => {
    if (availableJobs.length > 0) {
      if (!selectedJobId || !availableJobs.some((j) => j.id === selectedJobId)) {
        setSelectedJobId(availableJobs[0].id)
      }
    }
  }, [availableJobs, selectedJobId])

  // Shortlisting Quota & AI Agent State
  const [targetQuota, setTargetQuota] = useState<number>(1)
  const [shortlistReport, setShortlistReport] = useState<ShortlistReport | null>(null)
  const [shortlistModalOpen, setShortlistModalOpen] = useState(false)
  const [shortlistLoading, setShortlistLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Resume Viewer State
  const [viewingResumeApp, setViewingResumeApp] = useState<any | null>(null)

  // 1. Fetch Applied Resumes for Selected Job
  const { data: appsData, mutate: refreshApplications, isLoading: appsLoading } = useSWR(
    selectedJobId ? `/api/recruiter/applications?jobId=${encodeURIComponent(selectedJobId)}` : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json()
    },
    { revalidateOnFocus: true }
  )

  const applications: any[] = useMemo(() => {
    return appsData?.applications || []
  }, [appsData])

  // 2. Fetch Interview Submissions (Stage-Gated for Recruiter)
  const { data: subData, mutate: refreshSubmissions } = useSWR(
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

  const rankedSubmissions = useMemo(() => rankSubmissions(allSubmissions), [allSubmissions])

  const filteredSubmissions = useMemo(() => {
    if (!search.trim()) return rankedSubmissions
    const q = search.toLowerCase()
    return rankedSubmissions.filter(
      (s) =>
        s.candidateName.toLowerCase().includes(q) ||
        s.assessmentTitle.toLowerCase().includes(q)
    )
  }, [rankedSubmissions, search])

  const filteredApplications = useMemo(() => {
    if (!search.trim()) return applications
    const q = search.toLowerCase()
    return applications.filter(
      (a) =>
        (a.candidateName || "").toLowerCase().includes(q) ||
        (a.candidateEmail || "").toLowerCase().includes(q) ||
        (a.resumeText || "").toLowerCase().includes(q)
    )
  }, [applications, search])

  // Current selected job object
  const currentJob = useMemo(() => {
    return availableJobs.find((j) => j.id === selectedJobId) || availableJobs[0]
  }, [availableJobs, selectedJobId])

  // Run AI RAG Shortlist Agent
  async function handleRunShortlistAgent() {
    if (!selectedJobId) return
    setShortlistLoading(true)
    setShortlistModalOpen(true)
    setStatusMessage(null)

    try {
      const res = await fetch("/api/recruiter/shortlist-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJobId,
          targetCount: targetQuota,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to generate AI shortlist report")
      }

      setShortlistReport(data.report)
      refreshApplications()
    } catch (err: any) {
      console.error("[Run Shortlist Agent Error]:", err)
      setStatusMessage(err.message || "Failed to run agent")
    } finally {
      setShortlistLoading(false)
    }
  }

  // Handle Individual Candidate Decision
  async function handleIndividualDecision(
    applicationId: string,
    status: "shortlisted" | "advanced" | "rejected",
    note?: string
  ) {
    setActionLoadingId(applicationId)
    setStatusMessage(null)
    try {
      const res = await fetch("/api/recruiter/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          status,
          note: note || `Candidate marked as ${status} during recruiter review.`,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to record decision")
      }

      setStatusMessage(
        status === "advanced"
          ? "Candidate advanced to AI Interview! Email invitation & portal notification sent."
          : status === "shortlisted"
          ? "Candidate shortlisted! Email announcement dispatched."
          : "Candidate marked as rejected. Polite update dispatched."
      )

      refreshApplications()
      refreshSubmissions()
    } catch (err: any) {
      console.error("[Decision Error]:", err)
      setStatusMessage(err.message || "Failed to dispatch decision")
    } finally {
      setActionLoadingId(null)
    }
  }

  // Apply Batch Decisions from AI Shortlist Modal
  async function handleApplyAiDecisions(
    decisionsList: Array<{ applicationId: string; status: "shortlisted" | "advanced" | "rejected"; note?: string }>
  ) {
    const res = await fetch("/api/recruiter/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisions: decisionsList,
      }),
    })

    if (!res.ok) {
      throw new Error("Failed to dispatch AI shortlisting decisions")
    }

    refreshApplications()
    refreshSubmissions()
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-300">
      <PageHeader
        title="Candidate Pipeline & AI Shortlisting"
        description="Review candidate resumes, run RAG-grounded shortlisting agents to select top candidates according to your required quota, and evaluate interview reports."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/recruiter/results" />}>
              <BarChart3 className="size-4" /> Results Matrix
            </Button>
            <Button nativeButton={false} render={<Link href="/recruiter/job-creator" />}>
              <Sparkles className="size-4" /> Post New Role
            </Button>
          </div>
        }
      />

      {statusMessage && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-primary" />
            <span>{statusMessage}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setStatusMessage(null)} className="h-6 text-[11px]">
            Dismiss
          </Button>
        </div>
      )}

      {/* Tabs: Resume Shortlisting vs Interview Evaluations */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="shortlisting" className="text-xs gap-1.5 py-1.5 px-3">
              <FileText className="size-3.5" /> Resume Review &amp; Shortlisting ({applications.length})
            </TabsTrigger>
            <TabsTrigger value="interviews" className="text-xs gap-1.5 py-1.5 px-3">
              <Award className="size-3.5" /> Interview Round Reports ({filteredSubmissions.length})
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate by name…"
              className="pl-9 h-8 text-xs"
            />
          </div>
        </div>

        {/* TAB 1: RESUME SHORTLISTING (APPLIED RESUMES) */}
        <TabsContent value="shortlisting" className="flex flex-col gap-4 mt-4">
          {/* Job Selector & AI Agent Control Card */}
          <Card className="border-primary/20 bg-gradient-to-r from-card via-card to-primary/[0.03]">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="size-4 text-primary" />
                    <CardTitle className="text-base font-bold">Resume Shortlisting Agent</CardTitle>
                    <Badge variant="outline" className="border-primary/30 text-primary text-[10px] py-0">
                      RAG Grounded
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    Select a target job and specify how many candidates you want to shortlist. The AI agent evaluates all applied resumes, cites verifiable evidence, explains why it selected the top applicant, and dispatches candidate announcements.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                  <Button
                    onClick={handleRunShortlistAgent}
                    disabled={shortlistLoading || applications.length === 0}
                    className="gap-1.5 text-xs shadow-xs"
                  >
                    {shortlistLoading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5 text-primary-foreground" />
                    )}
                    {shortlistLoading ? "Shortlisting with AI…" : "Run AI Shortlist Agent"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="flex flex-wrap items-center gap-4 text-xs pt-3 border-t border-border/50">
                {/* Target Job Selector */}
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Target Role:</span>
                  {availableJobs.length > 0 ? (
                    <select
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary font-medium"
                    >
                      {availableJobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title} ({j.company})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                      <span>No roles posted by you yet.</span>
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0 text-xs text-primary font-medium"
                        nativeButton={false}
                        render={<Link href="/recruiter/job-creator" />}
                      >
                        + Post a Job
                      </Button>
                    </div>
                  )}
                </div>

                {/* Target Quota Selector */}
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Shortlist Quota:</span>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={targetQuota}
                      onChange={(e) => setTargetQuota(Number(e.target.value))}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground font-semibold"
                    >
                      <option value={1}>1 Candidate (Top Choice)</option>
                      <option value={2}>Top 2 Candidates</option>
                      <option value={3}>Top 3 Candidates</option>
                      <option value={5}>Top 5 Candidates</option>
                    </select>
                    <span className="text-[11px] text-muted-foreground">to advance</span>
                  </div>
                </div>

                <div className="ml-auto text-[11px] text-muted-foreground flex items-center gap-3">
                  <span>
                    <strong className="text-foreground">{applications.length}</strong> resumes received
                  </span>
                  <span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {applications.filter((a) => a.status === "advanced").length}
                    </strong>{" "}
                    advanced to interview
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Applied Candidates Table */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Applied Resumes for {currentJob?.title || "Role"}
                </CardTitle>
                <CardDescription className="text-xs">
                  Review applicant profiles, inspect resumes, and make individual or batch shortlisting decisions.
                </CardDescription>
              </div>

              {shortlistReport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShortlistModalOpen(true)}
                  className="text-xs gap-1.5 h-7"
                >
                  <Sparkles className="size-3 text-primary" /> View Latest Shortlist Report
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {appsLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              ) : filteredApplications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <FileText className="size-10 mb-2 opacity-30" />
                  <p className="font-medium text-foreground">No applications found for this role</p>
                  <p className="text-xs mt-1">
                    When candidates apply through the job portal, their resumes and contact details will appear here.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-12 text-center">Rank</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Resume</TableHead>
                      <TableHead>Match Score</TableHead>
                      <TableHead>Application Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApplications.map((app, idx) => {
                      const isActioning = actionLoadingId === app.id
                      const rankNum = app.aiShortlistRank || idx + 1
                      return (
                        <TableRow key={app.id} className="hover:bg-muted/20">
                          <TableCell className="text-center font-mono text-xs font-semibold text-muted-foreground">
                            {app.aiShortlistRank ? (
                              <Badge
                                variant={app.aiShortlistRank === 1 ? "default" : "secondary"}
                                className={`text-[10px] px-1.5 py-0 ${
                                  app.aiShortlistRank === 1 ? "bg-primary text-primary-foreground font-bold" : ""
                                }`}
                              >
                                #{app.aiShortlistRank}
                              </Badge>
                            ) : (
                              `#${idx + 1}`
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-xs text-foreground">{app.candidateName}</span>
                              <span className="text-[11px] text-muted-foreground">{app.candidateEmail}</span>
                              {app.phone && <span className="text-[10px] text-muted-foreground">{app.phone}</span>}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingResumeApp(app)}
                                className="h-7 text-[11px] gap-1 px-2 border border-border/50 hover:bg-muted"
                              >
                                <Eye className="size-3 text-primary" />
                                <span className="truncate max-w-[120px]">{app.resumeFileName || "View Resume"}</span>
                              </Button>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs tabular-nums text-foreground">
                                {app.aiShortlistScore || app.matchScore || 75}%
                              </span>
                              {app.aiValidationPassed && (
                                <span title="Audit Verified: Grounded in resume text">
                                  <ShieldCheck className="size-3 text-emerald-500" />
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] py-0 font-medium ${
                                app.status === "advanced"
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : app.status === "shortlisted"
                                  ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                  : app.status === "rejected"
                                  ? "border-rose-500/40 bg-rose-500/10 text-rose-500"
                                  : "border-muted-foreground/30 text-muted-foreground"
                              }`}
                            >
                              {app.status === "advanced"
                                ? "Advanced to Interview 🚀"
                                : app.status === "shortlisted"
                                ? "Shortlisted 🎉"
                                : app.status === "rejected"
                                ? "Rejected"
                                : "Under Review"}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isActioning ? (
                                <Loader2 className="size-4 animate-spin text-primary" />
                              ) : (
                                <>
                                  <Button
                                    variant={app.status === "advanced" ? "secondary" : "default"}
                                    size="sm"
                                    onClick={() => handleIndividualDecision(app.id, "advanced")}
                                    className="h-7 text-[11px] gap-1 px-2"
                                  >
                                    <Send className="size-3" /> Advance
                                  </Button>

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleIndividualDecision(app.id, "shortlisted")}
                                    className="h-7 text-[11px] px-2"
                                  >
                                    Shortlist
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleIndividualDecision(app.id, "rejected")}
                                    className="h-7 text-[11px] text-muted-foreground hover:text-rose-600 px-2"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
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

        {/* TAB 2: INTERVIEW ROUND EVALUATIONS (QUALIFIED CANDIDATES ONLY) */}
        <TabsContent value="interviews" className="flex flex-col gap-4 mt-4">
          <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 text-xs text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary shrink-0" />
              <span>
                <strong className="text-foreground">Stage-Gated Recruiter Pipeline: </strong>
                Only interview reports from candidates who passed resume shortlisting and were advanced appear in your evaluations. Practice mock interviews taken by unqualified applicants are filtered out.
              </span>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px] shrink-0 font-normal">
              Official Candidates Only
            </Badge>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Official Interview Performance Reports</CardTitle>
              <CardDescription className="text-xs">
                Candidates ranked objectively by verified technical interview answers and proctoring metrics.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <Users className="size-10 mb-2 opacity-30" />
                  <p className="font-medium text-foreground">No interview reports found yet</p>
                  <p className="text-xs mt-1">
                    When shortlisted candidates complete their AI technical interview, their official performance reports will be listed here.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-12 text-center">Rank</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead className="hidden md:table-cell">Role</TableHead>
                      <TableHead>AI Score</TableHead>
                      <TableHead className="hidden lg:table-cell">Integrity</TableHead>
                      <TableHead className="hidden lg:table-cell">Similarity</TableHead>
                      <TableHead>Review</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.map((s, idx) => {
                      const currentDecision = allDecisions[s.id]
                      return (
                        <TableRow key={s.id} className="hover:bg-muted/30">
                          <TableCell className="text-center font-mono text-xs text-muted-foreground font-semibold">
                            #{idx + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="font-semibold text-xs text-foreground">{s.candidateName}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(s.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell text-xs">
                            {s.jobTitle || s.assessmentTitle}
                          </TableCell>
                          <TableCell>
                            {s.result.overallScore === null ? (
                              <Badge variant="outline" className="text-warning border-warning/40 text-[10px]">
                                Flagged
                              </Badge>
                            ) : (
                              <span className="font-mono font-semibold text-xs tabular-nums text-foreground">
                                {s.result.overallScore}%
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <IntegrityBadge integrity={s.integrity} />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <SimilarityBadge similarity={s.similarity} />
                          </TableCell>
                          <TableCell>
                            <ReviewBadge submission={s} status={s.result?.reviewStatus} />
                          </TableCell>
                          <TableCell>
                            {currentDecision ? (
                              <DecisionBadge status={currentDecision.status} decidedAt={currentDecision.decidedAt} />
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Pending</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] gap-1 px-2"
                                onClick={() => setSelectedSubmission(s)}
                              >
                                <Mail className="size-3 text-primary" /> Decision &amp; Email
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                nativeButton={false}
                                render={<Link href={`/recruiter/candidates/${s.id}`} />}
                                title="Detailed Proctoring & Answer Report"
                                className="h-7 w-7"
                              >
                                <ExternalLink className="size-3.5" />
                              </Button>
                            </div>
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

      {/* AI RAG Shortlist Report Modal */}
      <AiShortlistModal
        open={shortlistModalOpen}
        onOpenChange={setShortlistModalOpen}
        report={shortlistReport}
        loading={shortlistLoading}
        onApplyDecisions={handleApplyAiDecisions}
      />

      {/* Resume Viewer Modal */}
      {viewingResumeApp && (
        <Dialog open={Boolean(viewingResumeApp)} onOpenChange={(open) => !open && setViewingResumeApp(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="size-4 text-primary" /> Candidate Resume: {viewingResumeApp.candidateName}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {viewingResumeApp.candidateEmail} {viewingResumeApp.phone ? `· ${viewingResumeApp.phone}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 mt-2">
              {viewingResumeApp.coverNote && (
                <div className="rounded-lg bg-muted/40 p-3 text-xs border border-border/50">
                  <span className="font-semibold text-foreground">Cover Note: </span>
                  <p className="mt-1 text-muted-foreground italic">&ldquo;{viewingResumeApp.coverNote}&rdquo;</p>
                </div>
              )}

              {viewingResumeApp.portfolioUrl && (
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Portfolio / GitHub: </span>
                  <a
                    href={viewingResumeApp.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline ml-1"
                  >
                    {viewingResumeApp.portfolioUrl}
                  </a>
                </div>
              )}

              <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Resume Content ({viewingResumeApp.resumeFileName || "Submitted Text"})
                </h4>
                <pre className="text-xs font-mono text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                  {viewingResumeApp.resumeText || "No readable text provided in this application."}
                </pre>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setViewingResumeApp(null)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    handleIndividualDecision(viewingResumeApp.id, "advanced")
                    setViewingResumeApp(null)
                  }}
                  className="gap-1.5"
                >
                  <Send className="size-3.5" /> Advance Candidate to Interview
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
