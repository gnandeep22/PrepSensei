import "server-only"
import { desc, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { application, job, user } from "@/lib/db/schema"
import { jobSchema, rowToJob, upsertJob } from "@/lib/jobs/server"
import { demoJobs, type JobApplication, type ApplicationStatus } from "@/lib/demo-data"

export const applicationInputSchema = z.object({
  job: jobSchema,
  status: z.enum(["saved", "applied"]).default("saved"),
  matchScore: z.number().int().min(0).max(100).nullable().optional(),
})

export type ApplicationInput = z.infer<typeof applicationInputSchema>

/**
 * Records the candidate's relationship to a job, upserting the job snapshot
 * first. Ownership is the session candidate id — never a client value. An
 * existing "applied" row is never downgraded back to "saved".
 */
export async function saveApplication(
  candidateUserId: string,
  input: ApplicationInput,
): Promise<JobApplication> {
  const jobRow = await upsertJob(input.job, candidateUserId)

  const [row] = await db
    .insert(application)
    .values({
      id: `app-${candidateUserId.slice(0, 8)}-${jobRow.id}`.slice(0, 200),
      candidateUserId,
      jobId: jobRow.id,
      status: input.status,
      matchScore: input.matchScore ?? null,
    })
    .onConflictDoUpdate({
      target: [application.candidateUserId, application.jobId],
      set: {
        // Applying is a one-way step; selecting again must not undo it.
        status: sql`case when ${application.status} = 'applied' then 'applied' else excluded.status end`,
        matchScore: sql`coalesce(excluded.match_score, ${application.matchScore})`,
        updatedAt: new Date(),
      },
    })
    .returning()

  return {
    id: row.id,
    jobId: row.jobId,
    status: row.status as ApplicationStatus,
    matchScore: row.matchScore,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    job: rowToJob(jobRow),
  }
}

/** Every job this candidate has saved or applied to, newest first. */
export async function listApplications(candidateUserId: string): Promise<JobApplication[]> {
  const rows = await db
    .select({ application, job })
    .from(application)
    .innerJoin(job, eq(application.jobId, job.id))
    .where(eq(application.candidateUserId, candidateUserId))
    .orderBy(desc(application.updatedAt))

  return rows.map(({ application: a, job: j }) => ({
    id: a.id,
    jobId: a.jobId,
    status: a.status as ApplicationStatus,
    matchScore: a.matchScore,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    job: rowToJob(j),
  }))
}

/**
 * Ensures a job has representative applicant resumes for testing the AI shortlisting workflow.
 * Seeds foreign key dependencies (job and user records) before inserting the demo applications.
 */
export async function ensureSampleApplications(jobId: string) {
  // 1. Check if applications already exist for this job
  const existing = await db.select().from(application).where(eq(application.jobId, jobId))
  if (existing.length > 0) return existing

  // 2. Ensure job exists in job table
  const existingJob = await db.select().from(job).where(eq(job.id, jobId)).limit(1)
  if (existingJob.length === 0) {
    const dj = demoJobs.find((j) => j.id === jobId)
    await db
      .insert(job)
      .values({
        id: jobId,
        title: dj?.title || "Python Backend Developer",
        company: dj?.company || "Streamline Health",
        location: dj?.location || "Remote",
        type: (dj?.type as any) || "Full-time",
        experience: dj?.experience || "2-4 years",
        salary: dj?.salary || "$80k – $100k",
        requiredSkills: dj?.requiredSkills || ["Python", "FastAPI", "PostgreSQL", "Docker", "REST APIs"],
        description: dj?.description || "Build scalable microservices and APIs with Python and PostgreSQL.",
        posted: dj?.posted || "Recently",
        source: "demo",
      })
      .onConflictDoNothing()
  }

  // 3. Ensure demo candidate users exist in user table
  const demoUsers = [
    { id: "demo-user-1", name: "Aarav Sharma", email: "aarav.sharma@example.com", role: "candidate" },
    { id: "demo-user-2", name: "Priya Patel", email: "priya.patel@example.com", role: "candidate" },
    { id: "demo-user-3", name: "Rohan Verma", email: "rohan.verma@example.com", role: "candidate" },
  ]
  for (const u of demoUsers) {
    await db.insert(user).values(u).onConflictDoNothing()
  }

  // 4. Insert the 3 sample applicant resumes with distinct profiles
  const sampleApplicants = [
    {
      id: `app-demo-1-${jobId}`,
      candidateUserId: "demo-user-1",
      jobId,
      candidateName: "Aarav Sharma",
      candidateEmail: "aarav.sharma@example.com",
      phone: "+91 98112 34567",
      status: "applied" as const,
      matchScore: 92,
      resumeFileName: "aarav_backend_lead.pdf",
      coverNote: "Senior engineer with 5 years building scalable distributed backends in Python, FastAPI, and PostgreSQL.",
      resumeText: `Aarav Sharma - Senior Software Engineer\nSummary: 5+ years experience building cloud-native microservices with FastAPI, PostgreSQL, Docker, Redis, and AWS. Architected high-throughput data processing pipelines serving 50M requests/day.\nSkills: Python, FastAPI, PostgreSQL, Redis, Docker, Kubernetes, AWS, System Architecture, CI/CD, Git\nProjects: High-speed Order Matching Engine (FastAPI, Redis, PostgreSQL) - reduced order latency from 45ms to 8ms.\nEducation: B.Tech in Computer Science, IIT Delhi`,
      portfolioUrl: "https://github.com/aarav-dev",
    },
    {
      id: `app-demo-2-${jobId}`,
      candidateUserId: "demo-user-2",
      jobId,
      candidateName: "Priya Patel",
      candidateEmail: "priya.patel@example.com",
      phone: "+91 97234 56789",
      status: "applied" as const,
      matchScore: 78,
      resumeFileName: "priya_fullstack.pdf",
      coverNote: "Full stack developer proficient in React, Node.js, and TypeScript. Eager to take on backend challenges.",
      resumeText: `Priya Patel - Full Stack Developer\nSummary: 3 years building web apps using React, Next.js, Node.js, Express, and MongoDB. Basic experience with PostgreSQL and Docker in staging environments.\nSkills: JavaScript, TypeScript, React, Next.js, Node.js, Express, MongoDB, HTML, CSS, TailwindCSS, Git\nProjects: E-Commerce Storefront (Next.js, Node.js, Stripe) - built customer checkout and catalog search.\nEducation: B.S. in Information Technology, Mumbai University`,
      portfolioUrl: "https://github.com/priya-patel",
    },
    {
      id: `app-demo-3-${jobId}`,
      candidateUserId: "demo-user-3",
      jobId,
      candidateName: "Rohan Verma",
      candidateEmail: "rohan.verma@example.com",
      phone: "+91 99887 65432",
      status: "applied" as const,
      matchScore: 61,
      resumeFileName: "rohan_junior_fe.pdf",
      coverNote: "Frontend developer enthusiastic about creating modern responsive interfaces with React and Tailwind.",
      resumeText: `Rohan Verma - Frontend Engineer\nSummary: 2 years experience building responsive web UIs using React, Redux, and TailwindCSS. Minimal backend exposure.\nSkills: React, Redux, JavaScript, HTML5, CSS3, TailwindCSS, Figma, Git\nProjects: Portfolio Builder UI - created custom component library in React.\nEducation: B.Tech in Computer Science, Pune University`,
      portfolioUrl: "https://github.com/rohan-ui",
    },
  ]

  for (const item of sampleApplicants) {
    try {
      await db.insert(application).values(item).onConflictDoNothing()
    } catch (e) {
      console.error("[ensureSampleApplications insert error]:", e)
    }
  }

  return await db.select().from(application).where(eq(application.jobId, jobId))
}
