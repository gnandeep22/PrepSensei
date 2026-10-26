"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  ExternalLink,
  FileCheck2,
  FileText,
  Globe,
  HelpCircle,
  Layers,
  Lightbulb,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Video,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { demoJobs } from "@/lib/demo-data"
import { JobSelect } from "@/components/job-select"
import { Field, PageHeader, SkillBar } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { SkillGapAnalysisResult } from "@/app/api/skill-gap/route"

export default function SkillGapPage() {
  const { profile, selectedJobId, selectedJob, selectJob, evaluation, allJobs, resumeUploaded, resumeFileName } = useApp()
  const availableJobs = allJobs && allJobs.length > 0 ? allJobs : demoJobs
  const jobId = selectedJobId ?? availableJobs[0].id
  const job = selectedJob ?? availableJobs.find((j) => j.id === jobId) ?? availableJobs[0]

  const [ragAnalysis, setRagAnalysis] = useState<SkillGapAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelSource, setModelSource] = useState<string | null>(null)

  const fetchRagSkillGap = useCallback(
    async (forceRefresh = false) => {
      if (!job || !profile) return

      const cacheKey = `prepsensei_rag_skillgap_${job.id}_${(profile.skills || []).join("_")}_${profile.name || ""}`

      if (!forceRefresh) {
        try {
          const cached = sessionStorage.getItem(cacheKey)
          if (cached) {
            const parsed = JSON.parse(cached)
            setRagAnalysis(parsed.analysis)
            setModelSource(parsed.source || "cached")
            return
          }
        } catch {}
      }

      setLoading(true)
      setError(null)

      try {
        const res = await fetch("/api/skill-gap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job,
            profile,
          }),
        })

        if (!res.ok) {
          throw new Error("Failed to generate RAG skill gap analysis")
        }

        const data = await res.json()
        if (data.analysis) {
          setRagAnalysis(data.analysis)
          setModelSource(data.source)
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(data))
          } catch {}
        } else {
          throw new Error(data.error || "No analysis returned from model")
        }
      } catch (err: any) {
        console.error("[Skill Gap RAG Error]:", err)
        setError(err.message || "Unable to compute RAG skill gap analysis. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    [job, profile]
  )

  useEffect(() => {
    fetchRagSkillGap()
  }, [fetchRagSkillGap])

  const requiredSkills = job.requiredSkills || []
  const candidateSkills = profile.skills || []

  // Check matching skills for quick pill comparison
  const matchedPills = requiredSkills.filter((r) =>
    candidateSkills.some((c) => c.toLowerCase() === r.toLowerCase() || r.toLowerCase().includes(c.toLowerCase()))
  )

  return (
    <>
      <PageHeader
        title="RAG AI Skill Gap Analysis"
        description="Compare your profile with the target role and focus on the gaps that matter."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Field label="Target job" htmlFor="job">
              <JobSelect
                id="job"
                value={job.id}
                currentJob={job}
                onChange={(nextId, nextJob) => {
                  selectJob(nextId, nextJob)
                }}
              />
            </Field>
            <div className="pt-5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchRagSkillGap(true)}
                disabled={loading}
                className="gap-1.5 text-xs h-9"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Analyzing…" : "Refresh analysis"}
              </Button>
            </div>
          </div>
        }
      />

      {/* RAG Engine Status / Grounding Evidence Header */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-xl border-primary/25 bg-primary/[0.05] p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <Sparkles className="size-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground tracking-tight">
                RAG Semantic Engine Active
              </span>
              {modelSource && (
                <Badge variant="outline" className="text-[10px] uppercase font-semibold py-0 px-1.5 border-primary/40 text-primary">
                  {modelSource.includes("gemini") ? "Gemini RAG" : modelSource}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {resumeUploaded
                ? `Evidence grounded in resume (${resumeFileName || "Candidate Resume"}) vs. ${job.title} at ${job.company}`
                : `Analyzing candidate profile vs. ${job.title} at ${job.company}`}
            </p>
          </div>
        </div>

        {ragAnalysis && (
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-xs font-medium text-muted-foreground">Overall Semantic Match</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-foreground tabular-nums">
                  {ragAnalysis.overallMatchScore}%
                </span>
                <Badge
                  variant={
                    ragAnalysis.roleFitTier === "Strong Match"
                      ? "default"
                      : ragAnalysis.roleFitTier === "Competitive Match"
                        ? "secondary"
                        : "outline"
                  }
                  className="text-[10px] font-semibold"
                >
                  {ragAnalysis.roleFitTier}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading && !ragAnalysis && (
        <Card className="border-border/80 p-8">
          <div className="flex flex-col items-center justify-center text-center gap-4">
            <div className="relative flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Loader2 className="size-7 animate-spin" />
            </div>
            <div className="flex flex-col gap-1 max-w-md">
              <h3 className="text-base font-semibold text-foreground">
                Analyzing Resume Against Job Requirements…
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The RAG pipeline is extracting responsibilities from {job.title} at {job.company} and matching every requirement against your resume accomplishments.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => fetchRagSkillGap(true)}>
            Try Again
          </Button>
        </div>
      )}

      {/* RAG Executive Summary Card */}
      {ragAnalysis && (
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck2 className="size-5 text-primary" />
              Executive RAG Alignment Summary
            </CardTitle>
            <CardDescription className="text-xs">
              Synthesized from ground-truth resume evidence against {job.company}&apos;s technical scope.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line bg-muted/30 p-3.5 rounded-lg border border-border/60">
              {ragAnalysis.matchSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Comparison Badge Bar */}
      <Card className="border-border/80">
        <CardContent className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center py-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your Documented Skills ({candidateSkills.length})
              </p>
              <Link href="/profile" className="text-[11px] text-primary hover:underline">
                Edit in profile →
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {candidateSkills.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {s}
                </Badge>
              ))}
              {candidateSkills.length === 0 && (
                <span className="text-xs text-muted-foreground">No skills in profile yet.</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
              VS
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {job.title} Requirements ({requiredSkills.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {requiredSkills.map((s) => {
                const isMatched = matchedPills.includes(s)
                return (
                  <Badge
                    key={s}
                    variant={isMatched ? "default" : "outline"}
                    className={`text-xs gap-1 ${
                      isMatched
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {isMatched && <CheckCircle2 className="size-3" />}
                    {s}
                  </Badge>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core Breakdown: Strong Skills vs Prioritized Gaps */}
      {ragAnalysis && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Evidence-Backed Strengths */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-emerald-500" />
                    Verified Strengths
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Skills substantiated by concrete evidence in your resume that meet {job.company}&apos;s needs.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs tabular-nums text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  {ragAnalysis.strongSkills.length} Verified
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {ragAnalysis.strongSkills.length === 0 && (
                <p className="text-xs text-muted-foreground">No direct verified strengths identified for this specific job.</p>
              )}

              {ragAnalysis.strongSkills.map((s) => (
                <div key={s.skill} className="flex flex-col gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-3.5">
                  <SkillBar label={s.skill} value={s.level} tone="success" />

                  {/* RAG Evidence Citation */}
                  <div className="flex flex-col gap-1 pt-1 text-xs">
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <span className="font-semibold text-foreground shrink-0">Resume Evidence:</span>
                      <span className="italic text-foreground/80">&ldquo;{s.evidenceFromResume}&rdquo;</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <span className="font-semibold text-foreground shrink-0">Role Relevance:</span>
                      <span>{s.relevanceToRole}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Prioritized Skill Gaps */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="size-5 text-amber-500" />
                    Prioritized Skill Gaps
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Job requirements absent or weakly substantiated in your resume, ranked by hiring hurdle.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs tabular-nums text-amber-600 dark:text-amber-400 border-amber-500/30">
                  {ragAnalysis.gaps.length} Gaps
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {ragAnalysis.gaps.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No gaps identified! Your resume strongly matches all specified requirements for this role.
                </div>
              )}

              {ragAnalysis.gaps.map((g) => {
                const isCritical = g.priority === "Critical"
                const isHigh = g.priority === "High"

                return (
                  <div
                    key={g.skill}
                    className={`flex flex-col gap-2.5 rounded-lg border p-3.5 transition-colors ${
                      isCritical
                        ? "border-destructive/30 bg-destructive/[0.03]"
                        : isHigh
                          ? "border-amber-500/30 bg-amber-500/[0.03]"
                          : "border-border/80 bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-foreground">{g.skill}</span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isCritical ? "destructive" : isHigh ? "secondary" : "outline"}
                          className="text-[10px] uppercase font-bold py-0.5 px-2"
                        >
                          {g.priority} Priority
                        </Badge>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          Prep: {g.estimatedTimeToBridge}
                        </span>
                      </div>
                    </div>

                    <SkillBar
                      label="Candidate Standing"
                      value={g.level}
                      tone={isCritical ? "destructive" : "warning"}
                      meta={<span className="text-[11px] text-muted-foreground">{g.candidateCurrentStanding}</span>}
                    />

                    {/* Why Needed in JD */}
                    <div className="flex flex-col gap-1 text-xs pt-1 border-t border-border/50">
                      <div className="flex items-start gap-1.5 text-muted-foreground">
                        <span className="font-semibold text-foreground shrink-0">Why Needed in JD:</span>
                        <span>{g.whyNeededInJob}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-muted-foreground">
                        <span className="font-semibold text-foreground shrink-0">Action Advice:</span>
                        <span>{g.actionableAdvice}</span>
                      </div>
                    </div>

                    {/* Learning Resources Bar */}
                    {g.resources && g.resources.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-xs">
                        <span className="text-[11px] font-semibold text-muted-foreground">Learn:</span>
                        {g.resources.map((res, i) => (
                          <a
                            key={i}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border/80 bg-card hover:bg-muted/60 text-[11px] font-medium text-foreground transition-colors"
                            title={res.description}
                          >
                            {res.type === "YouTube" ? (
                              <Video className="size-3 text-red-500" />
                            ) : res.type === "GeeksforGeeks" ? (
                              <BookOpen className="size-3 text-emerald-500" />
                            ) : res.type === "LeetCode" ? (
                              <Code2 className="size-3 text-amber-500" />
                            ) : res.type === "freeCodeCamp" ? (
                              <Globe className="size-3 text-cyan-500" />
                            ) : (
                              <FileText className="size-3 text-blue-500" />
                            )}
                            {res.title}
                            <ExternalLink className="size-2.5 opacity-60 ml-0.5" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Adjacent & Transferable Skills Section */}
      {ragAnalysis && ragAnalysis.adjacentSkills && ragAnalysis.adjacentSkills.length > 0 && (
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              Transferable &amp; Adjacent Skills
            </CardTitle>
            <CardDescription className="text-xs">
              Existing competencies in your resume that can accelerate mastering the role&apos;s missing requirements.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ragAnalysis.adjacentSkills.map((adj, i) => (
                <div key={i} className="flex flex-col justify-between rounded-lg border border-border/70 bg-card p-3.5 shadow-2xs gap-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {adj.candidateSkill}
                      </span>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                      <span className="font-semibold text-primary">
                        {adj.targetRequirement}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={adj.transferabilityPct} className="h-1.5 flex-1" />
                      <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
                        {adj.transferabilityPct}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {adj.notes}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Anticipated Interview Questions Targeting Identified Gaps */}
      {ragAnalysis && ragAnalysis.interviewQuestionsOnGaps && ragAnalysis.interviewQuestionsOnGaps.length > 0 && (
        <Card className="glass-panel border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <HelpCircle className="size-5 text-primary" />
                  Anticipated Technical Interview Questions on Gaps
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Interviewers will likely probe these exact areas. Prepare strategic answers that demonstrate conceptual depth.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/interview" />} className="text-xs gap-1.5">
                Practice in Mock Room <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3.5">
            {ragAnalysis.interviewQuestionsOnGaps.map((q, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-border/80 bg-card p-4 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm text-foreground">
                    &ldquo;{q.question}&rdquo;
                  </span>
                  <Badge variant="outline" className="text-[10px] shrink-0 font-medium">
                    Targeting: {q.targetedGap}
                  </Badge>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 text-xs pt-1 border-t border-border/50">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-muted-foreground">What Interviewers Look For:</span>
                    <p className="text-muted-foreground leading-relaxed">{q.whatInterviewersLookFor}</p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Recommended Strategy:</span>
                    <p className="text-foreground/90 leading-relaxed">{q.recommendedAnswerStrategy}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Next Step Action Card */}
      <Card className="border-border/80">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-5">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold text-foreground">
              Ready to Bridge These Gaps with a Structured Curriculum?
            </h4>
            <p className="text-xs text-muted-foreground">
              Generate an in-depth 4-week AI roadmap with working video walkthroughs, system design projects, and LeetCode problems specifically tailored to {job.title} at {job.company}.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button nativeButton={false} render={<Link href="/study-plan" />} className="gap-2">
              Generate 4-Week AI Roadmap <ArrowRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
