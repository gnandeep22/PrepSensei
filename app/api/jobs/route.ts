import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { job as jobTable } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { fetchIndianApiJobs } from "@/lib/jobs/indianapi"
import { fetchJSearchJobs } from "@/lib/jobs/jsearch"
import { fetchJobfulJobs, type JobfulCategory } from "@/lib/jobs/jobful"
import type { Job } from "@/lib/demo-data"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get("query") ?? "").trim()
  const location = searchParams.get("location") ?? undefined
  const type = searchParams.get("type") ?? undefined
  const source = (searchParams.get("source") ?? "all").toLowerCase()
  const category = (searchParams.get("category") ?? "all").toLowerCase() as JobfulCategory
  const stateCode = searchParams.get("state") ?? undefined

  const indianApiKey = process.env.INDIANAPI_KEY || process.env.INDIAN_API_KEY
  const jsearchApiKey = process.env.JSEARCH_API_KEY

  // Query recruiter-published jobs from Neon PostgreSQL
  let dbJobsList: Job[] = []
  try {
    const dbJobs = await db.select().from(jobTable).orderBy(desc(jobTable.createdAt))
    dbJobsList = dbJobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      type: j.type as any,
      experience: j.experience,
      salary: j.salary,
      requiredSkills: (j.requiredSkills as string[]) || [],
      description: j.description,
      posted: j.posted || "Recently",
      url: j.url || undefined,
      source: "recruiter" as any,
    }))

    if (query) {
      const q = query.toLowerCase()
      dbJobsList = dbJobsList.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.requiredSkills.some((s) => s.toLowerCase().includes(q)) ||
          j.description.toLowerCase().includes(q)
      )
    }
  } catch (e) {
    console.warn("[jobs route] Could not query database jobs:", e)
  }

  // 1. Explicit Jobful request or general search
  if (source === "jobful" || (!indianApiKey && !jsearchApiKey)) {
    try {
      const jobfulJobs = await fetchJobfulJobs({
        query,
        category,
        location,
        stateCode,
        limit: 50,
      })

      return NextResponse.json({
        ok: true,
        source: "jobful",
        jobs: [...dbJobsList, ...jobfulJobs],
      })
    } catch (err) {
      console.error("[jobful api route error]:", err instanceof Error ? err.message : String(err))
      return NextResponse.json({ ok: true, source: "db_only", jobs: dbJobsList }, { status: 200 })
    }
  }

  // 2. Multi-source or corporate / tech search
  try {
    let results: Job[] = []
    let activeSource = "jobful"

    // If source is "all", fetch Jobful notifications in parallel with corporate jobs
    if (source === "all") {
      const promises: Promise<Job[]>[] = []

      // Always include live Jobful Indian notifications
      promises.push(
        fetchJobfulJobs({ query, category, location, stateCode, limit: 30 }).catch((e) => {
          console.warn("[Jobful in all sources failed]:", e)
          return []
        })
      )

      if (indianApiKey) {
        promises.push(
          fetchIndianApiJobs(indianApiKey, { query: query || "software developer", location, type }).catch((e) => {
            console.warn("[IndianAPI in all sources failed]:", e)
            return []
          })
        )
      } else if (jsearchApiKey) {
        promises.push(
          fetchJSearchJobs(jsearchApiKey, { query: query || "software developer", location, type }).catch((e) => {
            console.warn("[JSearch in all sources failed]:", e)
            return []
          })
        )
      }

      const settled = await Promise.all(promises)
      results = settled.flat()
      activeSource = "combined"
    } else if (indianApiKey) {
      results = await fetchIndianApiJobs(indianApiKey, {
        query: query || "software developer",
        location,
        type,
      })
      activeSource = "indianapi"
    } else if (jsearchApiKey) {
      results = await fetchJSearchJobs(jsearchApiKey, {
        query: query || "software developer",
        location,
        type,
      })
      activeSource = "jsearch"
    }

    return NextResponse.json({ ok: true, source: activeSource, jobs: [...dbJobsList, ...results] }, { status: 200 })
  } catch (err) {
    console.error("[jobs route error]:", err instanceof Error ? err.message : String(err))

    // Fallback directly to Jobful if corporate API fails
    try {
      const fallbackJobs = await fetchJobfulJobs({ query, category, location, stateCode, limit: 40 })
      if (fallbackJobs.length > 0 || dbJobsList.length > 0) {
        return NextResponse.json({ ok: true, source: "jobful", jobs: [...dbJobsList, ...fallbackJobs] }, { status: 200 })
      }
    } catch (fallbackErr) {
      console.error("[jobful fallback error]:", fallbackErr)
    }

    return NextResponse.json({ ok: true, source: "db_only", jobs: dbJobsList }, { status: 200 })
  }
}
