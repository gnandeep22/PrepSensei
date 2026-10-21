"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import { Loader2, Search, Sparkles, Building2, MapPin, Briefcase, Globe } from "lucide-react"
import { useApp } from "@/lib/store"
import { computeMatch, type Job, isRecruiterJob } from "@/lib/demo-data"
import { Field, PageHeader, nativeSelectClass } from "@/components/shared"
import { JobCard } from "@/components/job-card"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const defaultLocations = [
  "All locations",
  "Remote",
  "Bangalore",
  "Hyderabad",
  "Pune",
  "Mumbai",
  "Delhi NCR",
  "Noida",
  "Gurgaon",
  "Chennai",
]

const types = ["All types", "Full-time", "Contract", "Internship", "Remote"]

const categories = [
  { id: "all", label: "All Sectors" },
  { id: "engineering", label: "Engineering & Tech" },
  { id: "bank", label: "Banking & Finance" },
  { id: "railway", label: "Railways" },
  { id: "defence", label: "Defence & Police" },
  { id: "teaching", label: "Teaching & Faculty" },
  { id: "all-india", label: "All India Exams" },
]

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

export default function JobsPage() {
  const { profile, selectJob, allJobs } = useApp()
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const [location, setLocation] = useState("All locations")
  const [type, setType] = useState("All types")
  const [skills, setSkills] = useState<string[]>([])
  const [sourceFilter, setSourceFilter] = useState<"all" | "recruiter" | "market">("all")
  const [sourceJobs, setSourceJobs] = useState<Job[]>(allJobs || [])
  const [loading, setLoading] = useState(false)

  const recruiterCount = useMemo(() => sourceJobs.filter(isRecruiterJob).length, [sourceJobs])
  const marketCount = useMemo(() => sourceJobs.filter((j) => !isRecruiterJob(j)).length, [sourceJobs])

  // Keep in sync with store's allJobs initially if sourceJobs is empty
  useEffect(() => {
    if (sourceJobs.length === 0 && allJobs && allJobs.length > 0 && !query && category === "all") {
      setSourceJobs(allJobs)
    }
  }, [allJobs, sourceJobs.length, query, category])

  // Fetch from the server API whenever search input, category, or location changes
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (query.trim()) params.set("query", query.trim())
        if (category !== "all") params.set("category", category)
        if (location !== "All locations") params.set("location", location)
        if (type !== "All types") params.set("type", type)

        const res = await fetch(`/api/jobs?${params.toString()}`, { signal: controller.signal })
        const data = await res.json()
        if (cancelled) return

        if (data.ok && Array.isArray(data.jobs)) {
          setSourceJobs(data.jobs as Job[])
        } else {
          setSourceJobs([])
        }
      } catch {
        // on network failure or abort, retain current jobs
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, category, location, type])

  // Dynamically derive available locations from actual jobs
  const availableLocations = useMemo(() => {
    const set = new Set<string>(defaultLocations)
    for (const j of sourceJobs) {
      if (j.location && j.location.length < 35) {
        set.add(j.location)
      }
    }
    return Array.from(set)
  }, [sourceJobs])

  // Dynamically derive top skills from active jobs
  const dynamicSkills = useMemo(() => {
    const counts = new Map<string, number>()
    for (const j of sourceJobs) {
      for (const s of j.requiredSkills || []) {
        const trimmed = s.trim()
        if (trimmed) {
          counts.set(trimmed, (counts.get(trimmed) || 0) + 1)
        }
      }
    }
    if (counts.size === 0) {
      return ["React.js", "Node.js", "Python", "PostgreSQL", "Next.js", "TypeScript", "FastAPI", "AWS", "SQL"]
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([skill]) => skill)
      .slice(0, 14)
  }, [sourceJobs])

  // Real-time instant filtering on current results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sourceJobs
      .filter((job) => {
        const matchesSource =
          sourceFilter === "all" ||
          (sourceFilter === "recruiter" && isRecruiterJob(job)) ||
          (sourceFilter === "market" && !isRecruiterJob(job))

        if (!matchesSource) return false

        const matchesQuery =
          !q ||
          job.title.toLowerCase().includes(q) ||
          job.company.toLowerCase().includes(q) ||
          (job.description && job.description.toLowerCase().includes(q)) ||
          job.requiredSkills.some((s) => s.toLowerCase().includes(q))

        const matchesLocation =
          location === "All locations" ||
          job.location.toLowerCase().includes(location.toLowerCase())

        const matchesType = type === "All types" || job.type === type

        const matchesSkills =
          skills.length === 0 ||
          skills.every((s) =>
            job.requiredSkills.some((k) => k.toLowerCase() === s.toLowerCase())
          )

        return matchesQuery && matchesLocation && matchesType && matchesSkills
      })
      .map((job) => ({ job, match: computeMatch(profile, job) }))
      .sort((a, b) => b.match.score - a.match.score)
  }, [query, location, type, skills, profile, sourceJobs, sourceFilter])

  function toggleSkill(s: string) {
    setSkills((prev) => (prev.includes(s) ? prev.filter((k) => k !== s) : [...prev, s]))
  }

  function resetAllFilters() {
    setQuery("")
    setCategory("all")
    setLocation("All locations")
    setType("All types")
    setSkills([])
    setSourceFilter("all")
  }

  const hasActiveFilters =
    query.trim() !== "" ||
    category !== "all" ||
    location !== "All locations" ||
    type !== "All types" ||
    skills.length > 0 ||
    sourceFilter !== "all"

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-5 sm:gap-6"
    >
      <motion.div variants={itemVariants}>
        <PageHeader
          title="Find Jobs & Opportunities"
          description="Explore roles directly published by PrepSensei recruiters alongside verified live internet market listings curated for your career awareness."
          actions={
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-medium">
                <Sparkles className="mr-1 size-3" /> Live Opportunities
              </Badge>
            </div>
          }
        />
      </motion.div>

      {/* Top Source Segmentation: All vs PrepSensei Direct Recruiter vs Internet Market */}
      <motion.div variants={itemVariants} className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/70">
            <button
              type="button"
              onClick={() => setSourceFilter("all")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                sourceFilter === "all"
                  ? "bg-background text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Opportunities
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {sourceJobs.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setSourceFilter("recruiter")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                sourceFilter === "recruiter"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="size-3" />
              PrepSensei Direct Recruiter Jobs
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0 h-4",
                  sourceFilter === "recruiter"
                    ? "border-white/40 text-white bg-white/10"
                    : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                )}
              >
                {recruiterCount}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setSourceFilter("market")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                sourceFilter === "market"
                  ? "bg-background text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Globe className="size-3 text-muted-foreground" />
              Internet Market Opportunities
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {marketCount}
              </Badge>
            </button>
          </div>

          <span className="text-xs text-muted-foreground hidden md:inline-block">
            <strong className="text-emerald-600 dark:text-emerald-400">{recruiterCount}</strong> direct hiring · <strong className="text-foreground">{marketCount}</strong> market discoveries
          </span>
        </div>

        {/* Source Guidance Alert */}
        {sourceFilter === "recruiter" && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2.5">
            <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">Direct Recruiter Hiring:</span>{" "}
              These roles are published directly by verified hiring partners on PrepSensei. Candidates can submit their application in one click, get evaluated by automated RAG shortlisting, and take official proctored assessment rounds.
            </div>
          </div>
        )}

        {sourceFilter === "market" && (
          <div className="rounded-xl border border-border/70 bg-card p-3.5 text-xs text-muted-foreground flex items-start gap-2.5 shadow-xs">
            <Globe className="size-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Market Discovery (Informational Purposes):</span>{" "}
              These jobs are gathered from public internet job notifications to give you real-time visibility into active market demand. Candidates apply directly on each company&apos;s website. You can also practice mock interviews and check skill alignment on PrepSensei!
            </div>
          </div>
        )}
      </motion.div>

      {/* Category selector pills */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-1.5 pb-1">
        {categories.map((c) => {
          const active = category === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                "rounded-full border px-3.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          )
        })}
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="rounded-xl border border-border/70 bg-card shadow-xs">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_200px_180px]">
              <Field label="Search" htmlFor="q">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="q"
                    placeholder="Role, company, skill (e.g. Frontend, React, Python, Engineer)..."
                    className="pl-8"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </Field>
              <Field label="Location" htmlFor="location">
                <select
                  id="location"
                  className={nativeSelectClass}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  {availableLocations.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Job type" htmlFor="type">
                <select id="type" className={nativeSelectClass} value={type} onChange={(e) => setType(e.target.value)}>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Filter by In-Demand Skills</span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dynamicSkills.map((s) => {
                  const on = skills.includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSkill(s)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                        on
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border/70 bg-card text-foreground hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {loading && <Loader2 className="size-3.5 animate-spin text-primary" />}
          {loading ? (
            "Updating job results…"
          ) : (
            <>
              <span className="font-semibold text-foreground">{results.length}</span>{" "}
              {results.length === 1 ? "opportunity" : "opportunities"} found
              {query && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-md text-foreground">
                  matching &ldquo;{query}&rdquo;
                </span>
              )}
            </>
          )}
        </p>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetAllFilters}>
            Reset filters
          </Button>
        )}
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-col gap-3">
        {results.map(({ job, match }) => (
          <JobCard
            key={job.id}
            job={job}
            match={match}
            candidateSkills={profile.skills}
            onSelect={() => selectJob(job.id, job)}
          />
        ))}

        {results.length === 0 && !loading && (
          <Card className="rounded-xl border-dashed border-border/80">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="size-8 text-muted-foreground/40 mb-3" />
              <p className="font-semibold text-foreground">No matching jobs found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {query
                  ? `We couldn't find any positions matching "${query}".`
                  : "No positions match the selected location or skill filters."}{" "}
                Try adjusting your search terms or clearing active filters.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={resetAllFilters}>
                Reset all filters
              </Button>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </motion.div>
  )
}
