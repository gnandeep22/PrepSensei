import "server-only"
import { extractSkills } from "@/lib/skills"
import type { Job } from "@/lib/demo-data"

export type IndianApiQuery = {
  query: string
  location?: string
  type?: string
  limit?: number
}

type RawIndianJob = {
  id?: string | number
  job_id?: string | number
  title?: string
  job_title?: string
  company?: string
  employer_name?: string
  company_name?: string
  about_company?: string
  location?: string
  job_location?: string
  job_type?: string
  employment_type?: string
  experience?: string
  salary?: string
  job_description?: string
  description?: string
  posted?: string
  posted_at?: string
  created_at?: string
  url?: string
  apply_link?: string
  link?: string
  job_required_skills?: string[]
  skills?: string[]
}

function normalizeJobType(rawType?: string, location?: string): Job["type"] {
  const combined = `${rawType || ""} ${location || ""}`.toLowerCase()
  if (combined.includes("remote") || combined.includes("work from home")) return "Remote"
  if (combined.includes("contract") || combined.includes("part time") || combined.includes("part-time")) return "Contract"
  if (combined.includes("intern")) return "Internship"
  return "Full-time"
}

function normalizeIndianJob(raw: RawIndianJob, index: number): Job {
  const title = (raw.title || raw.job_title || "Software Developer").trim()
  const company = (raw.company || raw.company_name || raw.employer_name || "Tech Company").trim()
  const location = (raw.location || raw.job_location || "India").trim()
  const type = normalizeJobType(raw.job_type || raw.employment_type, location)

  const description = (
    raw.job_description ||
    raw.description ||
    raw.about_company ||
    `${title} position at ${company}. Experience: ${raw.experience || "Not specified"}.`
  ).slice(0, 1000)

  const rawSkills = Array.isArray(raw.skills)
    ? raw.skills
    : Array.isArray(raw.job_required_skills)
      ? raw.job_required_skills
      : []

  const extracted = extractSkills([title, description, ...rawSkills].join(" "))
  const requiredSkills = (extracted.length ? extracted : ["JavaScript", "React", "Python", "SQL"]).slice(0, 10)

  return {
    id: String(raw.id || raw.job_id || `indianapi-${index}-${Date.now()}`),
    title,
    company,
    location,
    type,
    experience: raw.experience || "1-3 years",
    salary: raw.salary || "Competitive",
    requiredSkills,
    description,
    posted: raw.posted || raw.posted_at || raw.created_at || "Recently",
    url: raw.url || raw.apply_link || raw.link || undefined,
    source: "indianapi",
  }
}

/** Fetch and normalize real jobs from IndianAPI (https://jobs.indianapi.in/jobs). */
export async function fetchIndianApiJobs(apiKey: string, params: IndianApiQuery): Promise<Job[]> {
  const url = new URL("https://jobs.indianapi.in/jobs")

  if (params.query?.trim()) {
    url.searchParams.set("title", params.query.trim())
  }

  if (params.location && !/^all\b/i.test(params.location)) {
    const cleanLocation = params.location.replace(/,\s*(India|Canada)$/i, "").trim()
    url.searchParams.set("location", cleanLocation)
  }

  if (params.type && params.type !== "All types") {
    url.searchParams.set("job_type", params.type)
  }

  url.searchParams.set("limit", String(params.limit || 20))

  const res = await fetch(url.toString(), {
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12_000),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => "")
    throw new Error(`IndianAPI responded ${res.status}: ${errorText}`)
  }

  const json = await res.json()
  const rawList: RawIndianJob[] = Array.isArray(json)
    ? json
    : Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.jobs)
        ? json.jobs
        : []

  return rawList.map(normalizeIndianJob).filter((j) => j.title && j.id)
}
