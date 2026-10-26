"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  CheckCircle2,
  Circle,
  Sparkles,
  Loader2,
  ExternalLink,
  BookOpen,
  Video,
  FileText,
  GitBranch,
  Laptop,
  RefreshCw,
  HelpCircle,
  Target,
  ArrowRight,
  Clock,
  Briefcase,
  AlertCircle,
  Code2,
  Building2,
  Terminal,
  Globe,
  Compass,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { demoJobs, studyPlan as fallbackStudyPlan, type Job } from "@/lib/demo-data"
import { analyzeSkills, buildStudyPlan } from "@/lib/interview/skill-analysis"
import { JobSelect } from "@/components/job-select"
import { Field, PageHeader, SkillBar, nativeSelectClass } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { GeneratedStudyPlan } from "@/app/api/study-plan/route"
import { resolveReliableUrl, getResourcePlatform, type PlatformInfo } from "@/lib/study-plan/url-resolver"

export default function StudyPlanPage() {
  const { studyProgress, toggleStudyWeek, evaluation, selectedJob, selectedJobId, selectJob, profile, allJobs } = useApp()
  const availableJobs = allJobs && allJobs.length > 0 ? allJobs : demoJobs
  const jobId = selectedJobId ?? availableJobs[0].id
  const job = selectedJob ?? availableJobs.find((j) => j.id === jobId) ?? availableJobs[0]

  const [aiPlan, setAiPlan] = useState<GeneratedStudyPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derive initial gaps from evaluation or profile comparison memoized
  const analysis = useMemo(
    () => (evaluation ? analyzeSkills(evaluation, job, profile) : null),
    [evaluation, job, profile],
  )
  // When no evaluation exists, use the job's required skills (not hardcoded demo gaps)
  const gapBadges = useMemo(
    () => (analysis ? analysis.gaps.map((g) => g.skill) : (job.requiredSkills ?? []).slice(0, 6)),
    [analysis, job.requiredSkills],
  )

  const fetchAiPlan = useCallback(
    async (forceRegenerate = false) => {
      const cacheKey = `prep-sensei-study-plan-v2-${job.id}`

      if (!forceRegenerate) {
        try {
          const cached = localStorage.getItem(cacheKey)
          if (cached) {
            const parsed = JSON.parse(cached)
            if (parsed && Array.isArray(parsed.weeks) && parsed.weeks.length > 0) {
              setAiPlan((curr) => {
                if (curr && JSON.stringify(curr) === JSON.stringify(parsed)) return curr
                return parsed
              })
              return
            }
          }
        } catch {
          // ignore cache read error
        }
      }

      setLoading(true)
      setError(null)

      try {
        const res = await fetch("/api/study-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job: {
              id: job.id,
              title: job.title,
              company: job.company,
              requiredSkills: job.requiredSkills,
              description: job.description,
            },
            candidateSkills: profile.skills,
            skillGaps: gapBadges,
            evaluation: evaluation
              ? {
                  overall: evaluation.overall,
                  improvements: evaluation.improvements,
                  summary: evaluation.summary,
                }
              : null,
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "Failed to generate AI study plan")
        }

        const data = await res.json()
        if (data.plan) {
          setAiPlan((curr) => {
            if (curr && JSON.stringify(curr) === JSON.stringify(data.plan)) return curr
            return data.plan
          })
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data.plan))
          } catch {
            // ignore localStorage quota error
          }
        }
      } catch (err: any) {
        console.warn("[StudyPlanPage] AI plan generation error:", err)
        setError(err.message || "Could not generate AI plan; showing curated roadmap.")
      } finally {
        setLoading(false)
      }
    },
    [job.id, job.title, job.company, job.requiredSkills, job.description, profile.skills, gapBadges, evaluation],
  )

  // Persistent Study Plan Completion State (Loaded from DB & localStorage)
  const [persistedProgress, setPersistedProgress] = useState<Record<number, boolean>>({})

  // Fetch or load from cache whenever selected job changes
  useEffect(() => {
    fetchAiPlan()

    let active = true
    const cacheKey = `prep-sensei-study-progress-v3-${job.id}`

    // 1. Initial read from localStorage
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && typeof parsed === "object") {
          setPersistedProgress(parsed)
        }
      } else {
        setPersistedProgress({})
      }
    } catch {}

    // 2. Fetch authenticated candidate progress from PostgreSQL
    fetch(`/api/study-plan/progress?jobId=${encodeURIComponent(job.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.progress) return
        setPersistedProgress((prev) => {
          const merged = { ...prev, ...data.progress }
          try {
            localStorage.setItem(cacheKey, JSON.stringify(merged))
          } catch {}
          return merged
        })
      })
      .catch((err) => console.warn("Failed to load study progress from server:", err))

    return () => {
      active = false
    }
  }, [job.id])

  const handleToggleWeek = useCallback(
    async (weekNum: number) => {
      const nextCompleted = !persistedProgress[weekNum]
      const nextState = { ...persistedProgress, [weekNum]: nextCompleted }
      const cacheKey = `prep-sensei-study-progress-v3-${job.id}`

      // Update UI immediately (optimistic)
      setPersistedProgress(nextState)
      toggleStudyWeek(weekNum)

      try {
        localStorage.setItem(cacheKey, JSON.stringify(nextState))
      } catch {}

      // Persist to DB under authenticated candidate
      try {
        await fetch("/api/study-plan/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: job.id,
            week: weekNum,
            completed: nextCompleted,
          }),
        })
      } catch (err) {
        console.warn("Failed to save study progress to server:", err)
      }
    },
    [persistedProgress, job.id, toggleStudyWeek]
  )

  // Fallback to deterministic plan if AI plan hasn't arrived
  const activeWeeks = aiPlan?.weeks || (analysis ? buildStudyPlan(analysis) : fallbackStudyPlan).map((w) => ({
    week: w.week,
    topic: w.topic,
    focusSkills: [w.topic],
    whyItMatters: w.whyItMatters,
    whatToLearn: w.whatToLearn,
    practice: w.practice,
    resources: [
      {
        title: `${w.topic} — Comprehensive Guide & Tutorials (YouTube)`,
        url: resolveReliableUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(w.topic + " " + job.title + " tutorial complete guide")}`, w.topic),
        type: "YouTube",
        description: "Video tutorials and comprehensive guides for this topic.",
      },
      {
        title: `${w.topic} — Study Material & Resources`,
        url: resolveReliableUrl(`https://www.google.com/search?q=${encodeURIComponent(w.topic + " " + job.title + " study material guide")}`, w.topic),
        type: "Study Material",
        description: "Curated study material, notes, and learning resources.",
      },
      {
        title: `${w.topic} — Practice Questions & Tests`,
        url: resolveReliableUrl(`https://www.google.com/search?q=${encodeURIComponent(w.topic + " " + job.title + " practice questions")}`, w.topic),
        type: "Practice",
        description: "Practice questions, mock tests, and exam preparation resources.",
      },
    ],
    interviewQuestions: [
      `What are the key concepts you need to understand about ${w.topic} for the ${job.title} role?`,
      `How would you apply your knowledge of ${w.topic} in a real-world scenario?`,
    ],
  }))

  const done = activeWeeks.filter((w) => !!persistedProgress[w.week]).length
  const totalWeeks = activeWeeks.length
  const pct = totalWeeks > 0 ? Math.round((done / totalWeeks) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
         title="Study plan"
         description="A focused four-week roadmap built around your target role and current skill gaps."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Field label="Target Job" htmlFor="target-job-select">
              <JobSelect
                id="target-job-select"
                value={job.id}
                currentJob={job}
                onChange={(nextId, nextJob) => {
                  selectJob(nextId, nextJob)
                }}
              />
            </Field>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAiPlan(true)}
              disabled={loading}
              className="self-end gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Researching web…
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5 text-primary" />
                  Regenerate with Gemini
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Target Job & Strategy Overview Card */}
      <Card className="glass-panel border-primary/20">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                <Briefcase className="size-3 mr-1" />
                {job.title} at {job.company}
              </Badge>
              {evaluation && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  <Sparkles className="size-3 mr-1" />
                  Interview Feedback Incorporated ({evaluation.overall}% score)
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium text-foreground">
              {aiPlan?.title || `Personalized Interview Roadmap for ${job.title}`}
            </p>
            <p className="text-xs text-muted-foreground max-w-2xl">
              {aiPlan?.summary ||
                `Focused curriculum prioritizing your skill gaps in ${gapBadges.slice(0, 4).join(", ")} to ensure you succeed in your interview.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Targeting:</span>
            {gapBadges.slice(0, 4).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Loading state indicator */}
      {loading && (
        <Card className="border-dashed border-primary/40 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="relative flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-pulse">
              <Sparkles className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">Building your study plan…</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                Researching authentic documentation, open-source repositories, and technical interview benchmarks for{" "}
                <strong>{job.title}</strong> at <strong>{job.company}</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Bar Card */}
      {!loading && (
        <Card>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between py-4">
            <div className="flex-1">
              <SkillBar
                label="Curriculum Progress"
                value={pct}
                meta={`${done} of ${totalWeeks} weeks complete`}
                tone="success"
              />
            </div>
            {aiPlan?.estimatedHoursPerWeek && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5 text-primary" />
                <span>Recommended: {aiPlan.estimatedHoursPerWeek} hrs/week</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Week-by-Week Curriculum */}
      {!loading && (
        <ol className="flex flex-col gap-5">
          {activeWeeks.map((week) => {
            const complete = !!persistedProgress[week.week]
            return (
              <li key={week.week}>
                <Card className={cn("transition-all", complete && "border-emerald-500/40 bg-emerald-500/[0.02] shadow-xs")}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex size-10 shrink-0 flex-col items-center justify-center rounded-lg text-xs font-semibold leading-none shadow-sm transition-colors",
                          complete ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground",
                        )}
                      >
                        <span className="text-[9px] uppercase tracking-wider">Week</span>
                        <span className="text-base font-bold">{week.week}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base">{week.topic}</CardTitle>
                          {week.focusSkills?.map((skill: string) => (
                            <Badge key={skill} variant="secondary" className="text-[11px] font-normal">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                        <CardDescription className="text-xs leading-relaxed">{week.whyItMatters}</CardDescription>
                      </div>
                    </div>
                    <Button
                      variant={complete ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => void handleToggleWeek(week.week)}
                      className={cn(
                        "shrink-0 transition-colors",
                        complete && "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400",
                      )}
                    >
                      {complete ? (
                        <>
                          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 mr-1.5" /> Completed
                        </>
                      ) : (
                        <>
                          <Circle className="size-4 mr-1.5" /> Mark complete
                        </>
                      )}
                    </Button>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-4 pt-1">
                    {/* 3 Pillars Grid: Why, What to Learn, Practice Activity */}
                    <div className="grid gap-3 md:grid-cols-3">
                      <Block title="Why It Matters For This Job">
                        <p className="text-xs text-muted-foreground leading-relaxed">{week.whyItMatters}</p>
                      </Block>

                      <Block title="Core Technical Concepts">
                        <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
                          {week.whatToLearn.map((w: string, idx: number) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </Block>

                      <Block title="Hands-on Practice & Project">
                        <p className="text-xs text-muted-foreground leading-relaxed">{week.practice}</p>
                      </Block>
                    </div>

                    {/* Vetted Web Resources & Documentation */}
                    {week.resources && week.resources.length > 0 && (
                      <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/20 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold flex items-center gap-1.5">
                            <BookOpen className="size-3.5 text-primary" />
                            Curated Web Resources &amp; Documentation ({week.resources.length})
                          </span>
                          <span className="text-[11px] text-muted-foreground">Verified authentic links</span>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {week.resources.map((res: any, rIdx: number) => {
                            const safeUrl = resolveReliableUrl(res.url, res.title, week.topic)
                            const platform = getResourcePlatform(safeUrl, res.type)
                            return (
                              <a
                                key={rIdx}
                                href={safeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex flex-col justify-between rounded-md border border-border/60 bg-card p-2.5 hover:border-primary/50 hover:bg-primary/[0.02] transition-colors"
                              >
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] py-0 px-1.5 gap-1 font-medium",
                                        platform.badgeStyle,
                                      )}
                                    >
                                      <DynamicResourceIcon iconName={platform.iconName} />
                                      {platform.label}
                                    </Badge>
                                    <ExternalLink className="size-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                  </div>
                                  <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1 mt-1">
                                    {res.title}
                                  </span>
                                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                    {res.description}
                                  </p>
                                </div>
                              </a>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Mock Interview Questions for This Topic */}
                    {week.interviewQuestions && week.interviewQuestions.length > 0 && (
                      <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/10 p-3">
                        <div className="flex items-center gap-1.5">
                          <HelpCircle className="size-3.5 text-primary" />
                          <span className="text-xs font-semibold">Mock Interview Questions To Test Yourself:</span>
                        </div>
                        <ul className="flex flex-col gap-1 pl-5 list-disc text-xs text-muted-foreground">
                          {week.interviewQuestions.map((q: string, qIdx: number) => (
                            <li key={qIdx} className="leading-relaxed">
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

function DynamicResourceIcon({ iconName }: { iconName: PlatformInfo["iconName"] }) {
  switch (iconName) {
    case "video":
      return <Video className="size-2.5 text-red-500" />
    case "book":
      return <BookOpen className="size-2.5 text-emerald-600 dark:text-emerald-400" />
    case "code":
      return <Code2 className="size-2.5 text-orange-500" />
    case "terminal":
      return <Terminal className="size-2.5 text-cyan-500" />
    case "building":
      return <Building2 className="size-2.5 text-rose-500" />
    case "compass":
      return <Compass className="size-2.5 text-sky-500" />
    case "git":
      return <GitBranch className="size-2.5 text-purple-500" />
    case "doc":
      return <FileText className="size-2.5 text-blue-500" />
    default:
      return <Globe className="size-2.5 text-muted-foreground" />
  }
}
