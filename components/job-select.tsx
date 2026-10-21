"use client"

import { useMemo } from "react"
import { useApp } from "@/lib/store"
import { demoJobs, type Job } from "@/lib/demo-data"
import { nativeSelectClass } from "@/components/shared"
import { cn } from "@/lib/utils"

export interface JobSelectProps {
  id?: string
  value?: string
  onChange: (jobId: string, job?: Job) => void
  currentJob?: Job | null
  className?: string
  disabled?: boolean
  jobs?: Job[]
}

export function JobSelect({
  id = "job-select",
  value,
  onChange,
  currentJob,
  className,
  disabled = false,
  jobs: customJobsList,
}: JobSelectProps) {
  const { allJobs } = useApp()
  const jobsList = customJobsList ?? (allJobs && allJobs.length > 0 ? allJobs : demoJobs)

  const activeId = value ?? currentJob?.id ?? jobsList[0]?.id ?? ""

  const { recruiterJobs, liveJobs, curatedJobs, customJob } = useMemo(() => {
    const recruiter: Job[] = []
    const live: Job[] = []
    const curated: Job[] = []

    const seenIds = new Set<string>()

    for (const j of jobsList) {
      if (!j?.id || seenIds.has(j.id)) continue
      seenIds.add(j.id)

      if (j.source === "recruiter" || j.id.startsWith("recruiter-")) {
        recruiter.push(j)
      } else if (j.source === "jobful" || j.source === "indianapi" || j.source === "jsearch") {
        live.push(j)
      } else if (demoJobs.some((d) => d.id === j.id)) {
        curated.push(j)
      } else {
        live.push(j)
      }
    }

    // Check if currentJob is not in any of the above
    const isCustom = currentJob && !seenIds.has(currentJob.id) ? currentJob : null

    return {
      recruiterJobs: recruiter,
      liveJobs: live,
      curatedJobs: curated.length > 0 ? curated : demoJobs,
      customJob: isCustom,
    }
  }, [jobsList, currentJob])

  return (
    <select
      id={id}
      disabled={disabled}
      className={cn(nativeSelectClass, "min-w-64 max-w-full text-ellipsis", className)}
      value={activeId}
      onChange={(e) => {
        const nextId = e.target.value
        const found =
          jobsList.find((j) => j.id === nextId) ??
          demoJobs.find((j) => j.id === nextId) ??
          (currentJob?.id === nextId ? currentJob : undefined)
        onChange(nextId, found)
      }}
    >
      {customJob && (
        <option value={customJob.id}>
          {customJob.title} — {customJob.company}
        </option>
      )}

      {recruiterJobs.length > 0 && (
        <optgroup label="📋 Recruiter Postings">
          {recruiterJobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title} — {j.company} {j.location ? `(${j.location})` : ""}
            </option>
          ))}
        </optgroup>
      )}

      {liveJobs.length > 0 && (
        <optgroup label="🌐 Live Job Listings">
          {liveJobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title} — {j.company} {j.location ? `(${j.location})` : ""}
            </option>
          ))}
        </optgroup>
      )}

      {curatedJobs.length > 0 && (
        <optgroup label="🎯 Curated Roles">
          {curatedJobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title} — {j.company}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}
