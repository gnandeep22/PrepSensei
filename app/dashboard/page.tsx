"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  FileCheck2,
  Loader2,
  MessagesSquare,
  Sparkles,
  Target,
  UserRound,
  Wand2,
} from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { useApp } from "@/lib/store"
import { computeMatch, demoJobs, type CandidateProfile } from "@/lib/demo-data"
import { MatchScore, PageHeader, SkillBar } from "@/components/shared"
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

  return {
    pct: Math.min(100, score),
    hint: missing.length > 0 ? `Add ${missing[0]} to strengthen match` : "Profile 100% complete",
  }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.065, delayChildren: 0.03 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] as const } },
}

function Metric({ label, value, detail, icon, progress, tone = "primary" }: {
  label: string
  value: ReactNode
  detail: string
  icon: ReactNode
  progress?: number
  tone?: "primary" | "success" | "warning"
}) {
  const toneClass = tone === "success" ? "text-success bg-success/10" : tone === "warning" ? "text-warning bg-warning/10" : "text-primary bg-primary/10"
  return (
    <div className="metric-card group rounded-2xl border border-border/70 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/[0.06]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <span className={cn("flex size-8 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110", toneClass)}>{icon}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {typeof progress === "number" && <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{progress}%</span>}
      </div>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>
      {typeof progress === "number" && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }} transition={{ duration: 0.8, delay: 0.25, ease: "easeOut" }} className={cn("h-full rounded-full", tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary")} />
        </div>
      )}
    </div>
  )
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
    allJobs,
    selectedJob,
    selectedJobId,
    selectJob,
    toggleStudyWeek,
  } = useApp()
  const [cachedPlan, setCachedPlan] = useState<any>(null)

  useEffect(() => {
    if (!isPending && (session?.user as any)?.role === "recruiter") router.replace("/recruiter")
  }, [session, isPending, router])

  const availableJobs = useMemo(() => allJobs && allJobs.length > 0 ? allJobs : demoJobs, [allJobs])
  const ranked = useMemo(() => availableJobs.map((job) => ({ job, match: computeMatch(profile, job) })).sort((a, b) => b.match.score - a.match.score), [availableJobs, profile])
  const targetRole = useMemo(() => {
    if (selectedJob) return selectedJob
    if (selectedJobId) {
      const found = availableJobs.find((j) => j.id === selectedJobId)
      if (found) return found
    }
    return ranked[0]?.job || availableJobs[0]
  }, [selectedJob, selectedJobId, availableJobs, ranked])
  const targetMatch = useMemo(() => computeMatch(profile, targetRole), [profile, targetRole])

  useEffect(() => {
    if (!targetRole?.id) return
    try {
      const raw = localStorage.getItem(`prep-sensei-study-plan-${targetRole.id}`)
      const parsed = raw ? JSON.parse(raw) : null
      setCachedPlan(parsed && Array.isArray(parsed.weeks) ? parsed : null)
    } catch {
      setCachedPlan(null)
    }
  }, [targetRole?.id])

  const dynamicGaps = useMemo(() => {
    const candidateSkillsLower = new Set((profile.skills || []).map((s) => s.toLowerCase()))
    const missing = (targetRole.requiredSkills || []).filter((req) => !candidateSkillsLower.has(req.toLowerCase()))
    const improvements = evaluation?.improvements || []
    const result: { skill: string; priority: "High" | "Medium"; level: number }[] = []
    for (const req of missing) {
      const flagged = improvements.some((imp) => imp.toLowerCase().includes(req.toLowerCase()))
      result.push({ skill: req, priority: flagged || result.length < 2 ? "High" : "Medium", level: flagged ? 25 : 45 })
    }
    if (result.length === 0 && improvements.length > 0) {
      for (const imp of improvements.slice(0, 2)) result.push({ skill: imp.split(" ").slice(0, 3).join(" "), priority: "Medium", level: 50 })
    }
    return result
  }, [targetRole, profile.skills, evaluation])

  const activeRoadmapWeeks = useMemo(() => {
    if (cachedPlan?.weeks?.length) return cachedPlan.weeks.map((w: any) => ({ week: w.week, topic: w.topic, isCustomAi: true }))
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
  const studyPct = activeRoadmapWeeks.length > 0 ? Math.round((completedWeeks / activeRoadmapWeeks.length) * 100) : 0
  const { pct: profilePct, hint: profileHint } = useMemo(() => calculateProfileScore(profile, resumeUploaded), [profile, resumeUploaded])
  const nextAction = useMemo(() => {
    if (!resumeUploaded) return { title: "Build your evidence base", description: "Upload your resume so PrepSensei can parse experience, projects, and technical skills into your profile.", cta: "Upload resume", href: "/resume", icon: FileCheck2 }
    if ((profile.skills || []).length < 3) return { title: "Complete your profile evidence", description: "Add your key skills, experiences, and headline to unlock more accurate matching and interview questions.", cta: "Edit profile", href: "/profile", icon: UserRound }
    if (!tailoredJobId) return { title: `Tailor your CV for ${targetRole.title}`, description: `Align your resume with ${targetRole.company}'s requirements using the evidence in your profile.`, cta: "Tailor CV now", href: "/cv-tailor", icon: Wand2 }
    if (!evaluation) return { title: `Practice for ${targetRole.title}`, description: "Run a role-specific voice and video interview to benchmark your technical delivery.", cta: "Start mock interview", href: "/interview", icon: MessagesSquare }
    if (completedWeeks === 0) return { title: "Start your preparation loop", description: `Bridge your identified gaps in ${dynamicGaps.slice(0, 2).map((g) => g.skill).join(", ") || "core architecture"} with a focused study plan.`, cta: "Open study plan", href: "/study-plan", icon: BookOpen }
    return { title: "Keep exploring the market", description: "Review role matches and benchmark your readiness against new opportunities.", cta: "Browse open jobs", href: "/jobs", icon: Briefcase }
  }, [resumeUploaded, profile.skills, tailoredJobId, targetRole, evaluation, completedWeeks, dynamicGaps])

  if (isPending || (session?.user as any)?.role === "recruiter") return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>

  const candidateDisplayName = session?.user?.name?.trim() || profile.name?.trim() || "Candidate"
  const firstName = candidateDisplayName.split(" ")[0]
  const ActionIcon = nextAction.icon

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="dashboard-shell -mx-4 -my-4 flex min-h-[calc(100svh-4rem)] flex-col gap-5 px-4 py-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 lg:py-7">
      <motion.div variants={itemVariants}>
        <PageHeader
          title={<span className="text-balance">Good to see you, <span className="text-primary">{firstName}</span>.</span>}
          description="Your preparation system for turning evidence into confident interviews."
          actions={<div className="flex items-center gap-2"><Button variant="outline" size="sm" nativeButton={false} render={<Link href="/jobs" />} className="gap-1.5 text-xs"><Briefcase className="size-3.5" /> Find roles</Button><Button size="sm" nativeButton={false} render={<Link href={nextAction.href} />} className="gap-1.5 bg-primary text-xs shadow-lg shadow-primary/20"><Sparkles className="size-3.5" /> {nextAction.cta}</Button></div>}
        />
      </motion.div>

      <motion.section variants={itemVariants} className="grid gap-4 lg:grid-cols-[1.45fr_0.75fr]">
        <div className="premium-surface relative overflow-hidden rounded-[1.5rem] border border-primary/25 p-5 sm:p-7">
          <div aria-hidden="true" className="absolute -right-24 -top-32 size-80 rounded-full bg-primary/15 blur-3xl" />
          <div aria-hidden="true" className="absolute bottom-0 right-1/4 h-px w-2/5 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="flex items-start justify-between gap-4">
              <div><Badge variant="outline" className="border-primary/35 bg-primary/10 text-primary"><span className="mr-1.5 size-1.5 rounded-full bg-success" /> Next best move</Badge><h2 className="mt-5 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">{nextAction.title}</h2><p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{nextAction.description}</p></div>
              <div className="hidden size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary sm:flex"><ActionIcon className="size-5" /></div>
            </div>
            <div className="flex flex-wrap items-center gap-3"><Button nativeButton={false} render={<Link href={nextAction.href} />} className="gap-2 shadow-lg shadow-primary/20">{nextAction.cta}<ArrowRight className="size-4" /></Button><span className="text-xs text-muted-foreground">Based on your current profile and activity</span></div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/80 p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Readiness signal</p><h2 className="mt-2 text-lg font-semibold">{targetRole.title}</h2><p className="text-xs text-muted-foreground">{targetRole.company} · {targetRole.location}</p></div><BarChart3 className="size-5 text-primary" /></div>
          <div className="mt-5 flex items-center gap-5"><MatchScore score={targetMatch.score} size="lg" label="fit" /><div className="min-w-0"><p className="text-sm font-medium">{targetMatch.matching.length} of {targetRole.requiredSkills.length} skills aligned</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{targetMatch.explanation}</p><Link href={`/matches/${targetRole.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">View match details <ArrowUpRight className="size-3" /></Link></div></div>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Profile strength" value={`${profilePct}%`} detail={profileHint} icon={<UserRound className="size-4" />} progress={profilePct} />
        <Metric label="Resume status" value={resumeUploaded ? "Ready" : "Missing"} detail={resumeUploaded ? (resumeFileName || "Parsed into profile") : "Upload to unlock matching"} icon={<FileCheck2 className="size-4" />} tone={resumeUploaded ? "success" : "warning"} />
        <Metric label="Interview score" value={evaluation ? `${evaluation.overall}%` : "—"} detail={evaluation ? `${targetRole.title.split(" ")[0]} interview` : "Practice to benchmark"} icon={<MessagesSquare className="size-4" />} progress={evaluation?.overall} tone={evaluation ? "success" : "primary"} />
        <Metric label="Study progress" value={`${studyPct}%`} detail={`${completedWeeks} of ${activeRoadmapWeeks.length} weeks marked done`} icon={<Target className="size-4" />} progress={studyPct} />
      </motion.section>

      <motion.section variants={itemVariants} className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="report-card overflow-hidden rounded-2xl border-border/70">
          <CardHeader className="border-b border-border/50 pb-4"><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Target className="size-4 text-primary" /> Focus areas</CardTitle><CardDescription className="mt-1 text-xs">The gaps that matter most for {targetRole.title}.</CardDescription></div><Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/skill-gap" />} className="gap-1 text-xs">Analyze <ArrowRight className="size-3.5" /></Button></div></CardHeader>
          <CardContent className="flex flex-col gap-3 pt-4">{dynamicGaps.length === 0 ? <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-success/35 bg-success/[0.05] px-5 py-8 text-center"><CheckCircle2 className="size-7 text-success" /><p className="mt-2 text-sm font-semibold">No critical gaps found</p><p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Your profile evidence covers this role's core requirements. Test your readiness in a mock interview.</p><Button size="sm" variant="outline" nativeButton={false} render={<Link href="/interview" />} className="mt-4 text-xs">Start mock interview</Button></div> : dynamicGaps.slice(0, 4).map((gap, index) => <motion.div key={gap.skill} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} className="rounded-xl border border-border/60 bg-background/30 p-3.5"><SkillBar label={gap.skill} value={gap.level} tone={gap.priority === "High" ? "destructive" : "warning"} meta={<Badge variant={gap.priority === "High" ? "destructive" : "secondary"} className="px-1.5 py-0 text-[10px]">{gap.priority}</Badge>} /><div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground"><span>Suggested resources</span><div className="flex items-center gap-2"><a href={`https://devdocs.io/#q=${encodeURIComponent(gap.skill)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">Docs <ExternalLink className="size-2.5" /></a><a href={`https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(gap.skill)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-muted-foreground hover:text-foreground hover:underline">Guide <ExternalLink className="size-2.5" /></a></div></div></motion.div>)}</CardContent>
        </Card>

        <Card className="report-card overflow-hidden rounded-2xl border-border/70">
          <CardHeader className="border-b border-border/50 pb-4"><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="size-4 text-primary" /> Active roadmap {cachedPlan?.weeks && <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[9px] text-primary"><Sparkles className="mr-1 size-2.5" /> AI tailored</Badge>}</CardTitle><CardDescription className="mt-1 text-xs">A focused loop for {targetRole.title}.</CardDescription></div><Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/study-plan" />} className="gap-1 text-xs">Full plan <ArrowRight className="size-3.5" /></Button></div></CardHeader>
          <CardContent className="flex flex-col gap-2.5 pt-4">{activeRoadmapWeeks.map((week: { week: number; topic: string }) => { const isDone = Boolean(studyProgress[week.week]); return <button key={week.week} type="button" onClick={() => toggleStudyWeek(week.week)} className={cn("group flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all duration-200", isDone ? "border-success/35 bg-success/[0.05]" : "border-border/60 bg-background/30 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.03]")}><span className="flex min-w-0 items-center gap-3"><span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", isDone ? "bg-success text-white" : "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary")}>{isDone ? <CheckCircle2 className="size-3.5" /> : week.week}</span><span className={cn("truncate text-xs font-medium", isDone ? "text-muted-foreground line-through" : "text-foreground")}>{week.topic}</span></span><span className="shrink-0 text-[10px] text-muted-foreground">{isDone ? "Done" : "Mark done"}</span></button> })}<div className="mt-1 flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><Clock className="size-3.5 text-primary" /> Recommended: 8–10 hrs / week</span><Link href="/study-plan" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">Resources <ArrowRight className="size-3" /></Link></div></CardContent>
        </Card>
      </motion.section>

      <motion.section variants={itemVariants} className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="report-card overflow-hidden rounded-2xl border-border/70"><CardHeader className="border-b border-border/50 pb-4"><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Briefcase className="size-4 text-primary" /> Recommended roles</CardTitle><CardDescription className="mt-1 text-xs">Ranked dynamically from your profile evidence.</CardDescription></div><Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/jobs" />} className="gap-1 text-xs">All roles <ArrowRight className="size-3.5" /></Button></div></CardHeader><CardContent className="flex flex-col gap-2 pt-4">{ranked.slice(0, 4).map(({ job, match }) => { const isSelected = job.id === targetRole.id; return <button key={job.id} type="button" onClick={() => selectJob(job.id, job)} className={cn("group flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all duration-200", isSelected ? "border-primary/55 bg-primary/[0.06]" : "border-border/60 hover:border-primary/25 hover:bg-muted/30")}><span className="flex min-w-0 items-center gap-3"><MatchScore score={match.score} size="sm" /><span className="min-w-0"><span className="flex items-center gap-2"><span className="truncate text-xs font-semibold group-hover:text-primary">{job.title}</span>{isSelected && <Badge variant="secondary" className="hidden shrink-0 bg-primary/15 px-1.5 py-0 text-[9px] text-primary sm:inline-flex">Active target</Badge>}</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{job.company} · {job.location} · {job.type}</span></span></span><span className="hidden shrink-0 items-center gap-2 text-[11px] text-muted-foreground sm:flex">{match.matching.length}/{job.requiredSkills.length} skills <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" /></span></button> })}</CardContent></Card>
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.045] p-5 sm:p-6"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Code2 className="size-5" /></div><h2 className="mt-4 text-lg font-semibold">A better interview starts with a sharper signal.</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Use your role match, focus areas, and interview feedback together. Every action here is tied to the evidence already in your PrepSensei profile.</p><div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" size="sm" nativeButton={false} render={<Link href="/interview" />} className="gap-1.5 text-xs"><MessagesSquare className="size-3.5" /> Practice now</Button><Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/profile" />} className="gap-1.5 text-xs">Review profile <ArrowRight className="size-3.5" /></Button></div></div>
      </motion.section>
    </motion.div>
  )
}
