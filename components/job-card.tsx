"use client"

import { useState } from "react"
import Link from "next/link"
import { Briefcase, ExternalLink, Globe, MapPin, Send, Sparkles } from "lucide-react"
import { type Job, type MatchResult, isRecruiterJob } from "@/lib/demo-data"
import { MatchScore } from "@/components/shared"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { JobApplicationModal } from "@/components/jobs/job-application-modal"
import { cn } from "@/lib/utils"

export function JobCard({
  job,
  match,
  candidateSkills,
  onSelect,
}: {
  job: Job
  match: MatchResult
  candidateSkills: string[]
  onSelect?: () => void
}) {
  const [showApplyModal, setShowApplyModal] = useState(false)
  const have = new Set(candidateSkills.map((s) => s.toLowerCase()))
  const isDirectRecruiter = isRecruiterJob(job)
  const isJobful = job.id.startsWith("jobful-")
  const externalApplyUrl =
    job.url ||
    `https://www.google.com/search?q=${encodeURIComponent(`${job.company} ${job.title} careers apply`)}`

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        isDirectRecruiter
          ? "border-emerald-500/40 bg-gradient-to-r from-card via-card to-emerald-500/[0.04] hover:border-emerald-500/60"
          : "border-border/70 hover:border-border"
      )}
    >
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start p-5 sm:p-6">
        <MatchScore score={match.score} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{job.title}</h3>
              <Badge variant="outline">{job.type}</Badge>
              {isDirectRecruiter ? (
                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1 shadow-xs">
                  <Sparkles className="size-3" /> PrepSensei Direct Recruiter
                </Badge>
              ) : (
                <Badge variant="outline" className="border-border bg-muted/60 text-muted-foreground font-normal text-xs flex items-center gap-1">
                  <Globe className="size-3" /> Market Opportunity (External)
                </Badge>
              )}
              {isJobful && (
                <Badge variant="secondary" className="border-primary/30 bg-primary/10 text-primary font-normal text-xs">
                  Jobful Alert
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{job.company}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {job.location}
              </span>
              <span className="flex items-center gap-1">
                <Briefcase className="size-3.5" /> {job.experience}
              </span>
              <span>{job.salary}</span>
              <span>Posted {job.posted}</span>
            </div>

            {/* Informational vs Direct notice */}
            {isDirectRecruiter ? (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                <Sparkles className="size-3" /> Accepts in-platform applications · Managed directly by hiring partner
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Globe className="size-3 text-muted-foreground/70" /> Market discovery listing · For informational purposes (Apply on company portal)
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {job.requiredSkills.map((s) => (
              <Badge key={s} variant={have.has(s.toLowerCase()) ? "secondary" : "outline"} className={have.has(s.toLowerCase()) ? "" : "text-muted-foreground"}>
                {s}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-1.5 sm:self-center">
          {/* Action buttons: Direct in-platform apply vs External company apply */}
          {isDirectRecruiter ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                if (onSelect) onSelect()
                setShowApplyModal(true)
              }}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              <Send className="size-3.5" /> Apply on PrepSensei
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              nativeButton={false}
              render={
                <a
                  href={externalApplyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onSelect}
                />
              }
              className="gap-1.5"
            >
              <ExternalLink className="size-3.5" /> Apply on Company Site
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onSelect}
            nativeButton={false}
            render={<Link href={`/interview?jobId=${job.id}`} />}
            className="gap-1.5"
          >
            <Sparkles className="size-3.5 text-primary" /> Practice Interview
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onSelect}
            nativeButton={false}
            render={<Link href={`/matches/${job.id}`} />}
          >
            {isDirectRecruiter ? "Details" : "Skill Match & Details"}
          </Button>

          {isDirectRecruiter && job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 text-xs text-primary hover:underline px-1 py-0.5"
            >
              Official notice <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        {isDirectRecruiter && (
          <JobApplicationModal
            open={showApplyModal}
            onOpenChange={setShowApplyModal}
            job={job}
          />
        )}
      </CardContent>
    </Card>
  )
}
