import "server-only"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { assessment, type AssessmentRow } from "@/lib/db/schema"
import { jobSchema, upsertJob } from "@/lib/jobs/server"
import type { Assessment } from "@/lib/demo-data"

const difficultySchema = z.enum(["Easy", "Medium", "Hard"])
const baseQuestion = {
  id: z.string().min(1).max(120),
  skill: z.string().max(120).default(""),
  difficulty: difficultySchema.default("Medium"),
  question: z.string().min(1).max(4000),
}

/** Validates the recruiter-reviewed question set before it is persisted. */
export const questionSchema = z.discriminatedUnion("type", [
  z.object({
    ...baseQuestion,
    type: z.literal("mcq"),
    options: z.array(z.string().max(1000)).min(2).max(8),
    correctIndex: z.number().int().min(0).max(7),
    explanation: z.string().max(2000).default(""),
  }),
  z.object({
    ...baseQuestion,
    type: z.literal("short"),
    keyPoints: z.array(z.string().max(1000)).max(20).default([]),
  }),
  z.object({
    ...baseQuestion,
    type: z.literal("coding"),
    keyPoints: z.array(z.string().max(1000)).max(20).default([]),
    starterCode: z.string().max(8000).optional(),
  }),
])

export const assessmentInputSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(300),
  difficulty: difficultySchema.default("Medium"),
  status: z.enum(["draft", "published"]).default("draft"),
  questions: z.array(questionSchema).min(1).max(30),
  job: jobSchema,
})

export type AssessmentInput = z.infer<typeof assessmentInputSchema>

export function rowToAssessment(row: AssessmentRow): Assessment {
  return {
    id: row.id,
    title: row.title,
    jobId: row.jobId,
    jobTitle: row.jobTitle,
    company: row.company,
    difficulty: row.difficulty,
    status: row.status,
    questions: row.questions ?? [],
    createdAt: row.createdAt.toISOString(),
  }
}

/** Published assessments from every recruiter — what a candidate may take. */
export async function listPublishedAssessments(): Promise<Assessment[]> {
  const rows = await db
    .select()
    .from(assessment)
    .where(eq(assessment.status, "published"))
    .orderBy(desc(assessment.createdAt))
  return rows.map(rowToAssessment)
}

/** Every assessment owned by this recruiter, drafts included. */
export async function listRecruiterAssessments(recruiterUserId: string): Promise<Assessment[]> {
  const rows = await db
    .select()
    .from(assessment)
    .where(eq(assessment.recruiterUserId, recruiterUserId))
    .orderBy(desc(assessment.createdAt))
  return rows.map(rowToAssessment)
}

export class NotOwnerError extends Error {
  constructor() {
    super("not_owner")
  }
}

/**
 * Creates or updates an assessment for the calling recruiter. If the id already
 * exists under a different recruiter the write is refused rather than silently
 * reassigning ownership.
 */
export async function saveAssessment(recruiterUserId: string, input: AssessmentInput): Promise<Assessment> {
  const [existing] = await db.select().from(assessment).where(eq(assessment.id, input.id)).limit(1)
  if (existing && existing.recruiterUserId !== recruiterUserId) throw new NotOwnerError()

  const jobRow = await upsertJob(input.job, recruiterUserId)

  const values = {
    id: input.id,
    recruiterUserId,
    jobId: jobRow.id,
    title: input.title,
    jobTitle: jobRow.title,
    company: jobRow.company,
    difficulty: input.difficulty,
    status: input.status,
    questions: input.questions,
  }

  const [row] = await db
    .insert(assessment)
    .values(values)
    .onConflictDoUpdate({
      target: assessment.id,
      set: {
        jobId: values.jobId,
        title: values.title,
        jobTitle: values.jobTitle,
        company: values.company,
        difficulty: values.difficulty,
        status: values.status,
        questions: values.questions,
        updatedAt: new Date(),
      },
    })
    .returning()

  return rowToAssessment(row)
}

/** Deletes an assessment only when it belongs to the calling recruiter. */
export async function deleteAssessment(recruiterUserId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(assessment)
    .where(and(eq(assessment.id, id), eq(assessment.recruiterUserId, recruiterUserId)))
    .returning({ id: assessment.id })
  return deleted.length > 0
}

/** Loads an assessment by id regardless of owner (used when a candidate submits). */
export async function getAssessmentRow(id: string): Promise<AssessmentRow | null> {
  const [row] = await db.select().from(assessment).where(eq(assessment.id, id)).limit(1)
  return row ?? null
}
