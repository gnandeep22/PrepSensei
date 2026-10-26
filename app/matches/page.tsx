"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Search,
  Sparkles,
  Target,
  Wand2,
  MessagesSquare,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { computeMatch, demoJobs } from "@/lib/demo-data"
import { MatchScore, PageHeader, StatCard } from "@/components/shared"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
}

export default function MatchesPage() {
  const { profile, selectJob, selectedJobId, allJobs } = useApp()
  const [search, setSearch] = useState("")
  const availableJobs = allJobs && allJobs.length > 0 ? allJobs : demoJobs

  const ranked = useMemo(() => {
    return availableJobs
      .map((job) => ({ job, match: computeMatch(profile, job) }))
      .sort((a, b) => b.match.score - a.match.score)
  }, [availableJobs, profile])

  const filtered = useMemo(() => {
    if (!search.trim()) return ranked
    const q = search.toLowerCase()
    return ranked.filter(
      ({ job, match }) =>
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        match.matching.some((s) => s.toLowerCase().includes(q))
    )
  }, [ranked, search])

  const topScore = ranked[0]?.match.score || 0
  const strongMatches = ranked.filter((r) => r.match.score >= 70).length
  const avgScore = ranked.length > 0 ? Math.round(ranked.reduce((acc, r) => acc + r.match.score, 0) / ranked.length) : 0

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-5 sm:gap-6"
    >
      <motion.div variants={itemVariants}>
        <PageHeader
          title="Job Matches & Alignment"
        description="Open roles ranked by fit with your profile and skills."
          actions={
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/jobs" />} className="text-xs gap-1.5 font-medium">
              <Briefcase className="size-3.5" /> Browse All Jobs
            </Button>
          }
        />
      </motion.div>

      {/* Metric Cards */}
      <motion.div variants={itemVariants} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Top Match Score"
          value={`${topScore}%`}
          hint={ranked[0]?.job ? `${ranked[0].job.title.split(" ")[0]} at ${ranked[0].job.company}` : undefined}
          icon={<Target className="size-4" />}
          progress={topScore}
        />
        <StatCard
          label="Strong Fits (≥70%)"
          value={strongMatches}
          hint="High-confidence interview readiness"
          icon={<CheckCircle2 className="size-4 text-emerald-500" />}
          badge={strongMatches > 0 ? `${strongMatches} Roles` : undefined}
        />
        <StatCard
          label="Average Match"
          value={`${avgScore}%`}
          hint={`Across ${ranked.length} open opportunities`}
          icon={<Sparkles className="size-4" />}
          progress={avgScore}
        />
        <StatCard
          label="Total Open Roles"
          value={availableJobs.length}
          hint="Curated & recruiter-published"
          icon={<Briefcase className="size-4" />}
        />
      </motion.div>

      {/* Search and Table */}
      <motion.div variants={itemVariants}>
        <Card className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Matched Roles Leaderboard</CardTitle>
              <CardDescription className="text-xs">
                Click any role to set it as your active interview target or view grounded match evidence.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by role, skill, or city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="w-16">Match</TableHead>
                  <TableHead>Role & Company</TableHead>
                  <TableHead className="hidden md:table-cell">Location & Type</TableHead>
                  <TableHead className="hidden lg:table-cell">Matching Competencies</TableHead>
                  <TableHead className="hidden sm:table-cell">Missing Gaps</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(({ job, match }) => {
                  const isSelected = selectedJobId === job.id
                  return (
                    <TableRow
                      key={job.id}
                      className={cn(
                        "group transition-colors border-border/30 hover:bg-accent/40",
                        isSelected && "bg-primary/[0.03]"
                      )}
                    >
                      <TableCell className="py-3">
                        <MatchScore score={match.score} size="sm" />
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                              {job.title}
                            </span>
                            {isSelected && (
                              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[9px] py-0 px-1">
                                Active Target
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {job.company} · {job.experience}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-3">
                        <div className="flex flex-col text-xs text-muted-foreground">
                          <span>{job.location}</span>
                          <span className="text-[11px]">{job.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell py-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {match.matching.slice(0, 3).map((s) => (
                            <Badge key={s} variant="secondary" className="text-[10px] py-0 px-1.5">
                              ✓ {s}
                            </Badge>
                          ))}
                          {match.matching.length > 3 && (
                            <span className="text-[10px] text-muted-foreground self-center">
                              +{match.matching.length - 3} more
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {match.gaps.length === 0 ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="size-3" /> Fully matched
                            </span>
                          ) : (
                            match.gaps.slice(0, 2).map((s) => (
                              <Badge key={s} variant="outline" className="text-[10px] py-0 px-1.5 text-warning border-warning/30 bg-warning/5">
                                {s}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => selectJob(job.id, job)}
                          >
                            Set Target
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            nativeButton={false}
                            render={<Link href={`/matches/${job.id}`} />}
                            className="h-7 text-xs gap-1"
                          >
                            Details <ArrowRight className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}

                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-xs">
                      No roles matching &ldquo;{search}&rdquo;. Try another keyword.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
