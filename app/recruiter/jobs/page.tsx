"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import useSWR from "swr"
import { Briefcase, Building2, Calendar, ClipboardCheck, Plus, Search, Users, ExternalLink, Sparkles } from "lucide-react"
import { PageHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useApp } from "@/lib/store"
import type { Assessment, AssessmentSubmission } from "@/lib/demo-data"

export default function RecruiterJobsPage() {
  const { assessments, submissions } = useApp()
  const [search, setSearch] = useState("")

  const { data: assessData } = useSWR(
    "/api/assessment",
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json()
    },
    { revalidateOnFocus: true }
  )

  const { data: subData } = useSWR(
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
    for (const s of submissions) map.set(s.id, s)
    if (subData?.submissions && Array.isArray(subData.submissions)) {
      for (const s of subData.submissions) map.set(s.id, s)
    }
    return Array.from(map.values())
  }, [submissions, subData])

  const activeJobs = useMemo(() => {
    const byJob = new Map<
      string,
      {
        jobId: string
        jobTitle: string
        company: string
        assessments: Assessment[]
        applicants: number
      }
    >()

    for (const a of allAssessments) {
      const entry = byJob.get(a.jobId) ?? {
        jobId: a.jobId,
        jobTitle: a.jobTitle,
        company: a.company,
        assessments: [],
        applicants: 0,
      }
      entry.assessments.push(a)
      byJob.set(a.jobId, entry)
    }

    for (const s of allSubmissions) {
      const entry = byJob.get(s.jobId)
      if (entry) entry.applicants += 1
    }

    return Array.from(byJob.values())
  }, [allAssessments, allSubmissions])

  const filteredJobs = useMemo(() => {
    if (!search.trim()) return activeJobs
    const q = search.toLowerCase()
    return activeJobs.filter(
      (j) => j.jobTitle.toLowerCase().includes(q) || j.company.toLowerCase().includes(q)
    )
  }, [activeJobs, search])

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-300">
      <PageHeader
        title="Job Postings & Roles"
        description="All open roles created by the agent or recruiter. Each role has a connected AI technical screening assessment."
        actions={
          <div className="flex items-center gap-2">
            <Button nativeButton={false} render={<Link href="/recruiter/job-creator" />}>
              <Sparkles className="size-4" /> Agentic JD Creator
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/recruiter/assessments" />}>
              <Plus className="size-4" /> Create Manual Assessment
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search open positions or teams…"
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filteredJobs.length}</span> active position{filteredJobs.length === 1 ? "" : "s"}
        </p>
      </div>

      {filteredJobs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-3">
            <Briefcase className="size-6" />
          </div>
          <h3 className="font-semibold text-lg">No active jobs found</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-4">
            {search
              ? "No job postings matched your search criteria."
              : "You haven't published any jobs yet. Use the Agentic JD Creator to generate a full job posting and technical screening questions in seconds."}
          </p>
          <Button nativeButton={false} render={<Link href="/recruiter/job-creator" />}>
            <Sparkles className="size-4" /> Create First Job with AI Agent
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredJobs.map((j) => (
            <Card key={j.jobId} className="flex flex-col justify-between transition-all duration-200 hover:border-primary/50 hover:shadow-xs hover:-translate-y-0.5">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold">{j.jobTitle}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 mt-0.5">
                      <Building2 className="size-3.5" /> {j.company}
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                    Active
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 text-xs">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Total Applicants</span>
                    <span className="font-bold text-foreground text-sm flex items-center gap-1 mt-0.5">
                      <Users className="size-3.5 text-primary" /> {j.applicants} Candidate{j.applicants === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Screenings</span>
                    <span className="font-bold text-foreground text-sm flex items-center gap-1 mt-0.5">
                      <ClipboardCheck className="size-3.5 text-success" /> {j.assessments.length} Assessment{j.assessments.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Screening Questionnaires:</span>
                  <div className="flex flex-col divide-y divide-border/60">
                    {j.assessments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-1.5 text-xs">
                        <span className="truncate max-w-[220px] font-medium">{a.title}</span>
                        <span className="text-muted-foreground text-[11px]">{a.questions.length} questions</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border pt-3 mt-auto">
                  <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/recruiter/candidates?job=${j.jobId}`} />}>
                    <Users className="size-3.5 mr-1" /> View Candidates
                  </Button>
                  <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/interview?jobId=${j.jobId}`} />}>
                    <ExternalLink className="size-3.5 mr-1" /> Test AI Interview
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
