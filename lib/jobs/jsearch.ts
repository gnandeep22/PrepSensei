import "server-only"
import { extractSkills } from "@/lib/skills"
import type { Job } from "@/lib/demo-data"

export type JSearchQuery = { query: string; location?: string; type?: string }

const EMPLOYMENT_TO_TYPE: Record<string, Job["type"]> = {
  FULLTIME: "Full-time",
  CONTRACTOR: "Contract",
  INTERN: "Internship",
  PARTTIME: "Contract",
}

const TYPE_TO_EMPLOYMENT: Record<string, string> = {
  "Full-time": "FULLTIME",
  Contract: "CONTRACTOR",
  Internship: "INTERN",
}

type RawJob = {
  job_id?: string
  job_title?: string
  employer_name?: string
  job_city?: string
  job_state?: string
  job_country?: string
  job_is_remote?: boolean
  job_employment_type?: string
  job_description?: string
  job_apply_link?: string
  job_min_salary?: number
  job_max_salary?: number
  job_salary_currency?: string
  job_salary_period?: string
  job_required_skills?: string[] | null
  job_required_experience?: { required_experience_in_months?: number | null } | null
  job_highlights?: { Qualifications?: string[]; Responsibilities?: string[] } | null
  job_posted_at_timestamp?: number | null
}

function formatSalary(job: RawJob): string {
  const { job_min_salary: min, job_max_salary: max, job_salary_currency: cur, job_salary_period: period } = job
  if (!min && !max) return "Not specified"
  const symbol = cur === "USD" || cur === "CAD" || !cur ? "$" : `${cur} `
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`)
  const suffix = period && period !== "YEAR" ? `/${period.toLowerCase()}` : ""
  if (min && max) return `${symbol}${k(min)} – ${symbol}${k(max)}${suffix}`
  return `${symbol}${k((min || max) as number)}${suffix}`
}

function formatExperience(job: RawJob): string {
  const months = job.job_required_experience?.required_experience_in_months
  if (!months) return "Not specified"
  const years = Math.round(months / 12)
  return years <= 1 ? "0–1 years" : `${years}+ years`
}

function relativePosted(ts: number | null | undefined): string {
  if (!ts) return "Recently"
  const days = Math.floor((Date.now() - ts * 1000) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "1 day ago"
  if (days < 7) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`
}

function normalizeJob(raw: RawJob, index: number): Job {
  const remote = !!raw.job_is_remote
  const locationParts = [raw.job_city, raw.job_state, raw.job_country].filter(Boolean)
  const location = remote ? "Remote" : locationParts.join(", ") || "Not specified"
  const type: Job["type"] = remote ? "Remote" : EMPLOYMENT_TO_TYPE[raw.job_employment_type ?? ""] ?? "Full-time"

  const evidence = [
    raw.job_description ?? "",
    ...(raw.job_highlights?.Qualifications ?? []),
    ...(raw.job_highlights?.Responsibilities ?? []),
    ...(raw.job_required_skills ?? []),
  ].join(" ")
  const skillsFromApi = (raw.job_required_skills ?? []).filter(Boolean)
  const requiredSkills = (skillsFromApi.length ? skillsFromApi : extractSkills(evidence)).slice(0, 10)

  return {
    id: raw.job_id || `jsearch-${index}`,
    title: raw.job_title || "Untitled role",
    company: raw.employer_name || "Unknown company",
    location,
    type,
    experience: formatExperience(raw),
    salary: formatSalary(raw),
    requiredSkills,
    description: (raw.job_description || "No description provided.").slice(0, 1000),
    posted: relativePosted(raw.job_posted_at_timestamp),
    url: raw.job_apply_link,
    source: "jsearch",
  }
}

/** Fetch and normalize real jobs from JSearch. Throws if the request fails. */
export async function fetchJSearchJobs(apiKey: string, params: JSearchQuery): Promise<Job[]> {
  const queryParts = [params.query.trim()]
  if (params.location && !/^all\b/i.test(params.location)) queryParts.push(`in ${params.location}`)
  const query = queryParts.filter(Boolean).join(" ") || "software developer"

  const url = new URL("https://jsearch.p.rapidapi.com/search")
  url.searchParams.set("query", query)
  url.searchParams.set("page", "1")
  url.searchParams.set("num_pages", "1")
  if (params.type === "Remote") {
    url.searchParams.set("work_from_home", "true")
  } else if (params.type && TYPE_TO_EMPLOYMENT[params.type]) {
    url.searchParams.set("employment_types", TYPE_TO_EMPLOYMENT[params.type])
  }

  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
    signal: AbortSignal.timeout(12_000),
  })

  if (!res.ok) throw new Error(`JSearch responded ${res.status}`)
  const json = (await res.json()) as { data?: RawJob[] }
  const data = Array.isArray(json.data) ? json.data : []
  return data.map(normalizeJob).filter((j) => j.title && j.id)
}
