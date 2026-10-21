import "server-only"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { job, type JobRow } from "@/lib/db/schema"
import { demoJobs, type Job } from "@/lib/demo-data"

const jobTypes = ["Full-time", "Contract", "Internship", "Remote"] as const

/**
 * A job snapshot supplied by the client. Job listings are public data (a demo
 * row or a real JSearch result), so accepting a snapshot is safe — but it is
 * still validated and length-capped before it reaches Postgres.
 */
export const jobSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  company: z.string().max(200).default(""),
  location: z.string().max(200).default(""),
  type: z.enum(jobTypes).default("Full-time"),
  experience: z.string().max(120).default(""),
  salary: z.string().max(120).default(""),
  requiredSkills: z.array(z.string().max(80)).max(60).default([]),
  description: z.string().max(8000).default(""),
  posted: z.string().max(80).default(""),
  url: z.string().max(2000).optional(),
})

export type JobInput = z.infer<typeof jobSchema>

const demoJobIds = new Set(demoJobs.map((j) => j.id))

export function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    type: row.type,
    experience: row.experience,
    salary: row.salary,
    requiredSkills: row.requiredSkills ?? [],
    description: row.description,
    posted: row.posted,
    ...(row.url ? { url: row.url } : {}),
  }
}

/**
 * Inserts or refreshes a job in the shared catalogue so applications and
 * assessments always have a real row to reference. `createdBy` records the
 * first user who persisted it and is never overwritten.
 */
export async function upsertJob(input: JobInput, userId: string): Promise<JobRow> {
  const values = {
    id: input.id,
    source: (demoJobIds.has(input.id)
      ? "demo"
      : input.id.startsWith("jobful-")
        ? "jobful"
        : input.id.startsWith("indianapi-")
          ? "indianapi"
          : "jsearch") as "demo" | "jsearch" | "jobful" | "indianapi" | "recruiter",
    title: input.title,
    company: input.company,
    location: input.location,
    type: input.type,
    experience: input.experience,
    salary: input.salary,
    requiredSkills: input.requiredSkills,
    description: input.description,
    posted: input.posted,
    url: input.url ?? null,
    createdBy: userId,
  }

  const [row] = await db
    .insert(job)
    .values(values)
    .onConflictDoUpdate({
      target: job.id,
      set: {
        title: values.title,
        company: values.company,
        location: values.location,
        type: values.type,
        experience: values.experience,
        salary: values.salary,
        requiredSkills: values.requiredSkills,
        description: values.description,
        posted: values.posted,
        url: values.url,
        updatedAt: new Date(),
      },
    })
    .returning()
  return row
}

export async function getJobRow(jobId: string): Promise<JobRow | null> {
  const [row] = await db.select().from(job).where(eq(job.id, jobId)).limit(1)
  return row ?? null
}
