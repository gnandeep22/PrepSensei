"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Clock,
  Code2,
  ExternalLink,
  FileCheck2,
  FileText,
  GraduationCap,
  Loader2,
  MessagesSquare,
  Sparkles,
  Target,
  UserRound,
  Wand2,
} from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { useApp } from "@/lib/store"
import { computeMatch, demoJobs, type CandidateProfile, type Job } from "@/lib/demo-data"
import { MatchScore, PageHeader, SkillBar, StatCard } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

function calculateProfileScore(profile: CandidateProfile, resumeUploaded: boolean): { pct: number; hint: string } {
  let score = 0
  const missing: string[] = []

  if (profile.name?.trim()) score += 15
  else missing.push("name")

  if (profile.title?.trim()) score += 15
  else missing.push("headline")

  if (profile.summary?.trim()) score += 15
  else missing.push("summary")

  if (Array.isArray(profile.skills) && profile.skills.length >= 4) score += 20
  else if (Array.isArray(profile.skills) && profile.skills.length > 0) score += 10
  else missing.push("skills")

  if (Array.isArray(profile.experience) && profile.experience.length > 0) score += 15
  else missing.push("work experience")

  if (Array.isArray(profile.education) && profile.education.length > 0) score += 10
  else missing.push("education")

  if (resumeUploaded) score += 10
  else missing.push("resume PDF")

  const pct = Math.min(100, score)
  const hint = missing.length > 0 ? `Add ${missing[0]} to strengthen match` : "Profile 100% complete"

  return { pct, hint }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.03,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
}

export default function DashboardPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const {
    profile,
    resumeUploaded,
    resumeFileName,
    evaluation,
    studyProgress,
    tailoredJobId,
    interviewCompleted,
    allJobs,
    selectedJob,
    selectedJobId,
    selectJob,
    toggleStudyWeek,
  } = useApp()

  const [cachedPlan, setCachedPlan] = useState<any>(null)

  useEffect(() => {
    if (!isPending && (session?.user as any)?.role === "recruiter") {
      router.replace("/recruiter")
    }
  }, [session, isPending, router])

  const availableJobs = useMemo(() => {
    return allJobs && allJobs.length > 0 ? allJobs : demoJobs
  }, [allJobs])

  const ranked = useMemo(() => {
    return availableJobs
      .map((job) => ({ job, match: computeMatch(profile, job) }))
      .sort((a, b) => b.match.score - a.match.score)
  }, [availableJobs, profile])

  const targetRole = useMemo(() => {
    if (selectedJob) return selectedJob
    if (selectedJobId) {
      const found = availableJobs.find((j) => j.id === selectedJobId)
      if (found) return found
    }
    return ranked[0]?.job || availableJobs[0]
  }, [selectedJob, selectedJobId, availableJobs, ranked])

  const targetMatch = useMemo(() => {
    return computeMatch(profile, targetRole)
  }, [profile, targetRole])

  // Load study plan from cache if generated for this role
  useEffect(() => {
    if (!targetRole?.id) return
    try {
      const raw = localStorage.getItem(`prep-sensei-study-plan-${targetRole.id}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.weeks)) {
          setCachedPlan(parsed)
          return
        }
      }
    } catch {
      // ignore
    }
    setCachedPlan(null)
  }, [targetRole?.id])

  // Dynamically compute real gaps from target job vs profile
  const dynamicGaps = useMemo(() => {
    const candidateSkillsLower = new Set((profile.skills || []).map((s) => s.toLowerCase()))
    const required = targetRole.requiredSkills || []
    const missing = required.filter((req) => !candidateSkillsLower.has(req.toLowerCase()))

    const evalImprovements = evaluation?.improvements || []
    const result: { skill: string; priority: "High" | "Medium"; level: number }[] = []

    for (const req of missing) {
      const isFlaggedInInterview = evalImprovements.some((imp) => imp.toLowerCase().includes(req.toLowerCase()))
      result.push({
        skill: req,
        priority: isFlaggedInInterview || result.length < 2 ? "High" : "Medium",
        level: isFlaggedInInterview ? 25 : 45,
      })
    }

    if (result.length === 0 && evalImprovements.length > 0) {
      for (const imp of evalImprovements.slice(0, 2)) {
        result.push({
          skill: imp.split(" ").slice(0, 3).join(" "),
          priority: "Medium",
          level: 50,
        })
      }
    }

    return result
  }, [targetRole, profile.skills, evaluation])

  // Dynamically construct study roadmap items
  const activeRoadmapWeeks = useMemo(() => {
    if (cachedPlan?.weeks && cachedPlan.weeks.length > 0) {
      return cachedPlan.weeks.map((w: any) => ({
        week: w.week,
        topic: w.topic,
        isCustomAi: true,
      }))
    }

    const gap1 = dynamicGaps[0]?.skill || targetRole.requiredSkills[0] || "Architecture & Idioms"
    const gap2 = dynamicGaps[1]?.skill || targetRole.requiredSkills[1] || "System Scalability"
    const gap3 = dynamicGaps[2]?.skill || targetRole.requiredSkills[2] || "Data Layer Performance"

    return [
      { week: 1, topic: `${gap1} Core Depth & Fundamentals`, isCustomAi: false },
      { week: 2, topic: `${gap2} & System Design`, isCustomAi: false },
      { week: 3, topic: `${gap3} & Production Optimization`, isCustomAi: false },
      { week: 4, topic: "Mock Technical Interview & Behavioral Delivery", isCustomAi: false },
    ]
  }, [cachedPlan, dynamicGaps, targetRole])

  const completedWeeks = Object.values(studyProgress).filter(Boolean).length
  const totalRoadmapWeeks = activeRoadmapWeeks.length
  const studyPct = totalRoadmapWeeks > 0 ? Math.round((completedWeeks / totalRoadmapWeeks) * 100) : 0

  const { pct: profilePct, hint: profileHint } = useMemo(() => {
    return calculateProfileScore(profile, resumeUploaded)
  }, [profile, resumeUploaded])

  const nextAction = useMemo(() => {
    if (!resumeUploaded) {
      return {
        title: "Upload Your Resume",
        description: "Upload your PDF to automatically parse work experience, projects, and technical skills into your profile.",
        cta: "Upload Resume",
        href: "/resume",
      }
    }
    if ((profile.skills || []).length < 3) {
      return {
        title: "Complete Your Profile Evidence",
        description: "Add your key skills, experiences, and headline to unlock accurate AI job matching and interview questions.",
        cta: "Edit Profile",
        href: "/profile",
      }
    }
    if (!tailoredJobId) {
      return {
        title: `Tailor Your CV for ${targetRole.title}`,
        description: `Optimize your resume evidence against ${targetRole.company}'s requirements using grounded AI verification.`,
        cta: "Tailor CV Now",
        href: "/cv-tailor",
      }
    }
    if (!evaluation) {
      return {
        title: `Take an AI Mock Interview for ${targetRole.title}`,
        description: `Practice role-specific technical questions with voice/video capture, turn-taking transcription, and real-time evaluation.`,
        cta: "Start Mock Interview",
        href: "/interview",
      }
    }
    if (completedWeeks === 0) {
      return {
        title: `Begin Your 4-Week Study Plan`,
        description: `Bridge your identified gaps in ${dynamicGaps.slice(0, 2).map((g) => g.skill).join(", ") || "core architecture"} with curated web resources.`,
        cta: "Open Study Plan",
        href: "/study-plan",
      }
    }
    return {
      title: "Explore Open Career Opportunities",
      description: "Review top matches, apply to recruiter-posted roles, or benchmark your skills against new tech stacks.",
      cta: "Browse Open Jobs",
      href: "/jobs",
    }
  }, [resumeUploaded, profile.skills, tailoredJobId, targetRole, evaluation, completedWeeks, dynamicGaps])

  if (isPending || (session?.user as any)?.role === "recruiter") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const candidateDisplayName = session?.user?.name?.trim() || profile.name?.trim() || "Candidate"
  const firstName = candidateDisplayName.split(" ")[0]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-5 sm:gap-6"
    >
      {/* Header & Quick Action */}
      <motion.div variants={itemVariants}>
        <PageHeader
          title={`Welcome back, ${firstName}`}
          description="Your AI career copilot. Track your application pipeline, practice role-tailored interviews, and master your technical gaps."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/jobs" />}
                className="gap-1.5 transition-colors hover:border-primary/40 h-8 text-xs font-medium"
              >
                <Briefcase className="size-3 text-muted-foreground" />
                Find Jobs
              </Button>
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href={nextAction.href} />}
                className="gap-1.5 shadow-xs transition-all hover:shadow-sm h-8 text-xs font-medium"
              >
                <Sparkles className="size-3" />
                {nextAction.cta}
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* 4 Key Metrics in Ergonomic 4-Column Responsive Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <StatCard
          label="Profile Strength"
          value={`${profilePct}%`}
          hint={profileHint}
          icon={<UserRound className="size-4" />}
          progress={profilePct}
        />
        <StatCard
          label="Resume Status"
          value={resumeUploaded ? "Parsed" : "Missing"}
          hint={resumeUploaded ? (resumeFileName || "Synced with profile") : "Upload to auto-populate skills"}
          icon={<FileCheck2 className="size-4" />}
          badge={resumeUploaded ? "Verified" : "Missing"}
        />
        <StatCard
          label="Latest Interview Score"
          value={evaluation ? `${evaluation.overall}%` : "—"}
          hint={
            evaluation
              ? `${targetRole.title.split(" ")[0]} · ${(evaluation as any).recommendation || "Completed"}`
              : "Practice mock interview to benchmark"
          }
          icon={<MessagesSquare className="size-4" />}
          progress={evaluation?.overall}
        />
        <StatCard
          label="Study Plan Progress"
          value={`${studyPct}%`}
          hint={`${completedWeeks} of ${totalRoadmapWeeks} weeks mastered`}
          icon={<Target className="size-4" />}
          progress={studyPct}
        />
      </motion.div>

      {/* Target Job Spotlight & Recommended Jobs (2 Columns) */}
      <motion.div variants={itemVariants} className="grid gap-5 lg:grid-cols-3">
        {/* Spotlight Card */}
        <Card className="rounded-xl border border-border/70 bg-card shadow-xs transition-all duration-200 hover:border-border overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[11px] font-medium">
                Target Role
              </Badge>
              <Link
                href={`/matches/${targetRole.id}`}
                className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-0.5"
              >
                Details <ArrowUpRight className="size-3" />
              </Link>
            </div>
            <CardTitle className="text-base truncate mt-1">{targetRole.title}</CardTitle>
            <CardDescription className="text-xs truncate">
              {targetRole.company} · {targetRole.location}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <div className="flex items-center justify-center py-1">
              <MatchScore score={targetMatch.score} size="md" />
            </div>

            <p className="text-center text-xs text-muted-foreground line-clamp-2 leading-relaxed px-2">
              {targetMatch.explanation}
            </p>

            <div className="flex flex-col gap-1.5 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Matching Skills:</span>
                <span className="font-semibold text-foreground">
                  {targetMatch.matching.length} of {targetRole.requiredSkills.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {targetMatch.matching.slice(0, 4).map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px] py-0 px-1.5">
                    ✓ {s}
                  </Badge>
                ))}
                {targetMatch.gaps.slice(0, 2).map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px] py-0 px-1.5 text-warning border-warning/40 bg-warning/10">
                    Needs: {s}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/cv-tailor" />}
                className="w-full text-xs"
              >
                <Wand2 className="size-3 mr-1" /> Tailor CV
              </Button>
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/interview" />}
                className="w-full text-xs"
              >
                <MessagesSquare className="size-3 mr-1" /> Practice
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recommended Jobs List */}
        <Card className="lg:col-span-2 rounded-xl border border-border/70 bg-card shadow-xs transition-all duration-200 hover:border-border overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
            <div>
              <CardTitle className="text-sm font-semibold">Recommended Roles</CardTitle>
              <CardDescription className="text-xs">
                Ranked dynamically by relevance to your profile evidence.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/jobs" />} className="text-xs gap-1">
              All jobs <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-3">
            {ranked.slice(0, 4).map(({ job, match }) => {
              const isSelected = job.id === targetRole.id
              return (
                <div
                  key={job.id}
                  onClick={() => selectJob(job.id, job)}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 transition-all duration-150",
                    isSelected
                      ? "border-primary/60 bg-primary/[0.04] shadow-xs"
                      : "border-border/60 bg-card hover:border-border hover:bg-accent/40"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MatchScore score={match.score} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          {job.title}
                        </p>
                        {isSelected && (
                          <Badge variant="secondary" className="text-[9px] py-0 px-1 bg-primary/15 text-primary border-primary/25">
                            Active Target
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {job.company} · {job.location} · {job.type}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline-block text-[11px] text-muted-foreground">
                      {match.matching.length}/{job.requiredSkills.length} skills
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      nativeButton={false}
                      render={<Link href={`/matches/${job.id}`} />}
                      aria-label="View match"
                      className="size-7"
                    >
                      <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </motion.div>

      {/* Dynamic Skill Gaps & Active Study Plan (2 Columns) */}
      <motion.div variants={itemVariants} className="grid gap-5 lg:grid-cols-2">
        {/* Dynamic Skill Gaps */}
        <Card className="rounded-xl border border-border/70 bg-card shadow-xs transition-all duration-200 hover:border-border overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
            <div>
              <CardTitle className="text-sm font-semibold">Priority Skill Gaps</CardTitle>
              <CardDescription className="text-xs">
                Identified specifically for {targetRole.title} at {targetRole.company}.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/skill-gap" />}
              className="text-xs gap-1"
            >
              Analyze <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-3">
            {dynamicGaps.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center rounded-lg bg-accent/20 border border-dashed border-border/60">
                <CheckCircle2 className="size-6 text-emerald-500" />
                <p className="text-xs font-semibold text-foreground">No Critical Gaps Found!</p>
                <p className="text-[11px] text-muted-foreground max-w-xs">
                  Your profile evidence matches all core requirements for {targetRole.title}. Test your readiness in a mock interview.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/interview" />}
                  className="mt-1 text-xs"
                >
                  Start Mock Interview
                </Button>
              </div>
            ) : (
              dynamicGaps.slice(0, 4).map((gap) => (
                <div
                  key={gap.skill}
                  className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 hover:border-border transition-colors"
                >
                  <SkillBar
                    label={gap.skill}
                    value={gap.level}
                    tone={gap.priority === "High" ? "destructive" : "warning"}
                    meta={
                      <Badge
                        variant={gap.priority === "High" ? "destructive" : "secondary"}
                        className="text-[10px] py-0 px-1.5"
                      >
                        {gap.priority} Priority
                      </Badge>
                    }
                  />
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                    <span className="text-muted-foreground">Quick Resources:</span>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://devdocs.io/#q=${encodeURIComponent(gap.skill)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium inline-flex items-center gap-0.5"
                      >
                        Docs <ExternalLink className="size-2.5" />
                      </a>
                      <span className="text-muted-foreground">·</span>
                      <a
                        href={`https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(gap.skill)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-600 dark:text-amber-400 hover:underline font-medium inline-flex items-center gap-0.5"
                      >
                        Guide <ExternalLink className="size-2.5" />
                      </a>
                      <span className="text-muted-foreground">·</span>
                      <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(gap.skill + " full course tutorial")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-600 dark:text-red-400 hover:underline font-medium inline-flex items-center gap-0.5"
                      >
                        Video <ExternalLink className="size-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Dynamic Study Plan Widget */}
        <Card className="rounded-xl border border-border/70 bg-card shadow-xs transition-all duration-200 hover:border-border overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">Active Study Roadmap</CardTitle>
                {cachedPlan?.weeks && (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[9px] py-0">
                    <Sparkles className="size-2.5 mr-0.5" /> Gemini AI
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Tailored 4-week preparation plan for {targetRole.title}.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/study-plan" />}
              className="text-xs gap-1"
            >
              Full Plan <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-3">
            {activeRoadmapWeeks.map((week: { week: number; topic: string; isCustomAi?: boolean }) => {
              const isDone = Boolean(studyProgress[week.week])
              return (
                <div
                  key={week.week}
                  onClick={() => toggleStudyWeek(week.week)}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors",
                    isDone
                      ? "border-emerald-500/40 bg-emerald-500/[0.04]"
                      : "border-border/60 bg-card hover:border-border hover:bg-accent/30"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                        isDone ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                      )}
                    >
                      {isDone ? <CheckCircle2 className="size-3.5" /> : week.week}
                    </button>
                    <span
                      className={cn(
                        "text-xs font-medium truncate",
                        isDone ? "line-through text-muted-foreground" : "text-foreground group-hover:text-primary transition-colors"
                      )}
                    >
                      {week.topic}
                    </span>
                  </div>

                  <span className="text-[10px] text-muted-foreground shrink-0 pl-2">
                    {isDone ? "Done" : "Mark done"}
                  </span>
                </div>
              )
            })}

            <div className="mt-1 flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 p-2.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary" />
                Recommended: 8-10 hrs / week
              </span>
              <Link
                href="/study-plan"
                className="text-primary hover:underline font-semibold inline-flex items-center gap-1 text-xs"
              >
                Access Resources <ArrowRight className="size-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
