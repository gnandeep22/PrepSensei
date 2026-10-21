"use client"

import Link from "next/link"
import { notFound, useParams } from "next/navigation"
import { useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  MapPin,
  Quote,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { computeMatch, demoJobs, type Job, isRecruiterJob } from "@/lib/demo-data"
import { MatchScore, PageHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { JobApplicationModal } from "@/components/jobs/job-application-modal"
import type { SkillGapAnalysisResult } from "@/app/api/skill-gap/route"

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile, selectedJobId, selectedJob, selectJob, allJobs } = useApp()
  const [fetchedJob, setFetchedJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(false)
  const [ragAnalysis, setRagAnalysis] = useState<SkillGapAnalysisResult | null>(null)
  const [ragLoading, setRagLoading] = useState(false)
  const [showApplyModal, setShowApplyModal] = useState(false)

  // Use stored selectedJob when matching, or check allJobs/demoJobs before fetching.
  const job = (selectedJob && selectedJob.id === id ? selectedJob : null) ?? allJobs?.find((j) => j.id === id) ?? demoJobs.find((j) => j.id === id) ?? fetchedJob

  useEffect(() => {
    if (!job && id) {
      setLoading(true)
      fetch(`/api/assessment?jobId=${encodeURIComponent(id)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.job) {
            const mapped: Job = {
              id: data.job.id,
              title: data.job.title,
              company: data.job.company,
              location: data.job.location,
              type: data.job.type,
              experience: data.job.experience,
              salary: data.job.salary,
              requiredSkills: data.job.requiredSkills || [],
              description: data.job.description,
              posted: data.job.posted,
              url: data.job.url,
            }
            setFetchedJob(mapped)
            selectJob(mapped.id, mapped)
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [id, job, selectJob])

  useEffect(() => {
    if (job && selectedJobId !== job.id) selectJob(job.id, job)
  }, [job, selectedJobId, selectJob])

  // Fetch or load RAG analysis
  useEffect(() => {
    if (!job || !profile) return

    const cacheKey = `prepsensei_rag_skillgap_${job.id}_${(profile.skills || []).join("_")}_${profile.name || ""}`
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed?.analysis) {
          setRagAnalysis(parsed.analysis)
          return
        }
      }
    } catch {}

    setRagLoading(true)
    fetch("/api/skill-gap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job, profile }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.analysis) {
          setRagAnalysis(data.analysis)
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(data))
          } catch {}
        }
      })
      .catch((err) => console.warn("[Matches RAG fetch error]:", err))
      .finally(() => setRagLoading(false))
  }, [job, profile])

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading job details…</p>
      </div>
    )
  }

  if (!job) notFound()
  const baseMatch = computeMatch(profile, job)
  const displayScore = ragAnalysis ? ragAnalysis.overallMatchScore : baseMatch.score
  const displayExplanation = ragAnalysis?.matchSummary || baseMatch.explanation
  const roleFitTier = ragAnalysis?.roleFitTier || (displayScore >= 80 ? "Strong Match" : displayScore >= 60 ? "Competitive Match" : "Stretch Opportunity")

  const isDirectRecruiter = isRecruiterJob(job)
  const externalApplyUrl =
    job.url ||
    `https://www.google.com/search?q=${encodeURIComponent(`${job.company} ${job.title} careers apply`)}`

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/matches" />}>
          <ArrowLeft className="size-4" /> Back to matches
        </Button>
      </div>

      <PageHeader
        title={job.title}
        description={`${job.company} · ${job.location} · ${job.experience} · ${job.salary}`}
        actions={
          <>
            {isDirectRecruiter ? (
              <Button
                onClick={() => setShowApplyModal(true)}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <Send className="size-4" /> Apply on PrepSensei
              </Button>
            ) : (
              <Button
                variant="default"
                nativeButton={false}
                render={
                  <a
                    href={externalApplyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                className="gap-1.5"
              >
                <ExternalLink className="size-4" /> Apply on Company Portal
              </Button>
            )}
            <Button variant="outline" nativeButton={false} render={<Link href={`/interview?jobId=${job.id}`} />}>
              <Sparkles className="size-4 text-primary" /> Take AI Practice Interview
            </Button>
            {job.url && isDirectRecruiter && (
              <Button variant="outline" nativeButton={false} render={<a href={job.url} target="_blank" rel="noopener noreferrer" />}>
                Official Notice <ExternalLink className="size-4" />
              </Button>
            )}
            <Button variant="outline" nativeButton={false} render={<Link href="/skill-gap" />}>
              Skill Gap Deep Dive
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/cv-tailor" />}>
              Tailor CV for this job <ArrowRight className="size-4" />
            </Button>
          </>
        }
      />

      {/* Recruiter Direct vs External Market Informational Banner */}
      {isDirectRecruiter ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
          <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">PrepSensei Direct Recruiter Position:</span>{" "}
            This role is posted directly by our verified hiring partner on PrepSensei. When you click <strong>Apply on PrepSensei</strong>, your resume and profile are submitted into the recruiter&apos;s pipeline for automated RAG resume shortlisting and official proctored assessment.
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground flex items-start gap-3">
          <Globe className="size-4 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground">Market Discovery Listing (Informational):</span>{" "}
            This role is aggregated from external market sources to give you visibility into live industry opportunities and skill demand. Applications are not accepted directly inside PrepSensei for external roles; please click <strong>Apply on Company Portal</strong> to submit your application on the employer&apos;s website. You can still use PrepSensei to practice your AI mock interview and check your skill gap!
          </div>
        </div>
      )}

      {isDirectRecruiter && (
        <JobApplicationModal
          open={showApplyModal}
          onOpenChange={setShowApplyModal}
          job={job}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left Column: Overall Alignment Card */}
        <Card className="lg:row-span-2">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <MatchScore score={displayScore} size="lg" />
            <div className="text-center">
              <p className="text-2xl font-bold tracking-tight">{displayScore}% MATCH</p>
              <Badge variant="secondary" className="mt-1.5 text-xs bg-primary/10 text-primary border-primary/20">
                {roleFitTier}
              </Badge>
            </div>
            <p className="text-center text-xs leading-relaxed text-muted-foreground text-pretty">
              {displayExplanation}
            </p>
            <div className="flex w-full flex-col gap-2 rounded-lg bg-muted/40 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Experience level</span>
                <Badge variant={baseMatch.experienceMatch === "Strong" ? "default" : "secondary"}>
                  {baseMatch.experienceMatch}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Required skills covered</span>
                <span className="font-semibold tabular-nums">
                  {ragAnalysis ? ragAnalysis.strongSkills.length : baseMatch.matching.length} / {job.requiredSkills.length}
                </span>
              </div>
              {ragAnalysis?.adjacentSkills && ragAnalysis.adjacentSkills.length > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <span className="text-muted-foreground">Transferable skills</span>
                  <span className="font-medium text-primary">
                    +{ragAnalysis.adjacentSkills.length} bridgeable
                  </span>
                </div>
              )}
            </div>

            {ragLoading && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin text-primary" />
                <span>Refining with live Gemini RAG...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Middle: Strong Verified Skills */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" /> Grounded Matching Skills
              </span>
              <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                {ragAnalysis ? ragAnalysis.strongSkills.length : baseMatch.matching.length} verified
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Competencies directly substantiated by resume evidence and projects.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {ragAnalysis && ragAnalysis.strongSkills.length > 0 ? (
              ragAnalysis.strongSkills.map((s) => (
                <div key={s.skill} className="rounded-md border border-border/50 bg-muted/20 p-2.5 text-xs flex flex-col gap-1.5">
                  <div className="flex items-center justify-between font-medium">
                    <span className="flex items-center gap-1.5 text-foreground font-semibold">
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                      {s.skill}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                      {s.level}% proficiency
                    </span>
                  </div>
                  {s.evidenceFromResume && (
                    <p className="text-[11px] text-muted-foreground italic pl-5 border-l-2 border-primary/30 py-0.5">
                      &ldquo;{s.evidenceFromResume}&rdquo;
                    </p>
                  )}
                  {s.relevanceToRole && (
                    <p className="text-[10px] text-muted-foreground pl-5">
                      Satisfies: {s.relevanceToRole}
                    </p>
                  )}
                </div>
              ))
            ) : (
              baseMatch.matching.map((s) => (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span className="font-medium text-foreground">{s}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Right: Skill Gaps */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" /> Prioritized Skill Gaps
              </span>
              <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30">
                {ragAnalysis ? ragAnalysis.gaps.length : baseMatch.gaps.length} gaps
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Required competencies missing or needing further proof before interview.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {ragAnalysis && ragAnalysis.gaps.length > 0 ? (
              ragAnalysis.gaps.map((g) => (
                <div key={g.skill} className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                      {g.skill}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 font-medium ${
                        g.priority === "Critical"
                          ? "border-rose-500/40 text-rose-500 bg-rose-500/10"
                          : g.priority === "High"
                            ? "border-amber-500/40 text-amber-500 bg-amber-500/10"
                            : "border-muted-foreground/30 text-muted-foreground"
                      }`}
                    >
                      {g.priority} Priority
                    </Badge>
                  </div>
                  {g.whyNeededInJob && (
                    <p className="text-[11px] text-muted-foreground pl-5">
                      <span className="font-medium text-foreground/80">Why needed:</span> {g.whyNeededInJob}
                    </p>
                  )}
                  {g.actionableAdvice && (
                    <p className="text-[10px] text-muted-foreground/90 pl-5">
                      <span className="font-medium text-foreground/80">Bridge plan:</span> {g.actionableAdvice} ({g.estimatedTimeToBridge})
                    </p>
                  )}
                </div>
              ))
            ) : baseMatch.gaps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No gaps — you cover every listed skill.</p>
            ) : (
              baseMatch.gaps.map((s) => (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  <span className="text-foreground">{s}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Full width bottom cards */}
        {ragAnalysis?.adjacentSkills && ragAnalysis.adjacentSkills.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="size-4 text-primary" /> Transferable & Bridgeable Competencies
              </CardTitle>
              <CardDescription className="text-xs">
                How your proven skills map to the employer&apos;s requirements to accelerate your preparation.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {ragAnalysis.adjacentSkills.map((adj, idx) => (
                <div key={idx} className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/20 p-2.5 text-xs">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-foreground font-semibold">
                      {adj.candidateSkill} <span className="text-muted-foreground font-normal">→</span> {adj.targetRequirement}
                    </span>
                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                      {adj.transferabilityPct}% Transferable
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{adj.notes}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">About the role</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs leading-relaxed text-pretty text-muted-foreground">{job.description}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {job.location}
              </span>
              <span className="flex items-center gap-1">
                <Briefcase className="size-3.5" /> {job.type} · {job.experience}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {job.requiredSkills.map((s) => {
                const isMatched = ragAnalysis
                  ? ragAnalysis.strongSkills.some((sk) => sk.skill.toLowerCase() === s.toLowerCase())
                  : baseMatch.matching.includes(s)
                return (
                  <Badge key={s} variant={isMatched ? "secondary" : "outline"} className="text-xs">
                    {isMatched ? "✓ " : ""}{s}
                  </Badge>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/[0.03] p-3.5 text-xs text-muted-foreground shadow-2xs">
        <div className="flex items-center gap-2.5">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <span>
            <strong className="text-foreground font-medium">AI RAG Alignment Active:</strong> Match calculations cross-reference your verified profile, resume evidence, and projects against employer JD requirements in real time.
          </span>
        </div>
        <Badge variant="outline" className="border-primary/30 text-primary text-[10px] shrink-0 font-normal">
          {ragLoading ? "Refining..." : "Grounded Evaluation"}
        </Badge>
      </div>
    </div>
  )
}
