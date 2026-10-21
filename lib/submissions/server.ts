import "server-only"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { assessment, candidateProfile, submission, type SubmissionRow } from "@/lib/db/schema"
import { getAssessmentRow, rowToAssessment } from "@/lib/assessments/server"
import { evaluateShortAnswers } from "@/lib/assessment/evaluate-agent"
import { gradeSubmission, type ShortEval } from "@/lib/assessment/grade"
import { analyzeIntegrity } from "@/lib/assessment/integrity"
import { analyzeSimilarity } from "@/lib/assessment/plagiarism"
import type { AssessmentSubmission } from "@/lib/demo-data"

const evaluationSchema = z.object({
  overall: z.number().int().min(0).max(100),
  breakdown: z.array(z.object({ label: z.string().max(120), score: z.number().int().min(0).max(100) })).max(12),
  strengths: z.array(z.string().max(400)).max(12),
  improvements: z.array(z.string().max(400)).max(12),
})

export const submissionInputSchema = z.object({
  assessmentId: z.string().min(1).max(120),
  answers: z.record(z.string().max(120), z.string().max(20000)).default({}),
  /** Non-invasive session signals captured by the assessment page. */
  durationSeconds: z.number().int().min(0).max(86_400).nullable().default(null),
  submitAttempts: z.number().int().min(1).max(100).default(1),
  pastedQuestionCount: z.number().int().min(0).max(100).default(0),
  /** The candidate's own AI interview evaluation, when they completed one. */
  interview: evaluationSchema.nullable().optional(),
})

export type SubmissionInput = z.infer<typeof submissionInputSchema>

export class AssessmentNotFoundError extends Error {
  constructor() {
    super("assessment_not_found")
  }
}

function rowToSubmission(row: SubmissionRow): AssessmentSubmission {
  return {
    id: row.id,
    assessmentId: row.assessmentId,
    assessmentTitle: row.assessmentTitle,
    jobId: row.jobId,
    jobTitle: row.jobTitle,
    company: row.company,
    candidateName: row.candidateName,
    submittedAt: row.submittedAt.toISOString(),
    result: row.result,
    answers: row.answers ?? {},
    ...(row.integrity ? { integrity: row.integrity } : {}),
    ...(row.similarity ? { similarity: row.similarity } : {}),
    ...(row.interview ? { interview: row.interview } : {}),
  }
}

/** Display name for the submission: the account name, else the saved profile name. */
async function resolveCandidateName(userId: string, fallback: string): Promise<string> {
  const [row] = await db
    .select({ name: candidateProfile.name })
    .from(candidateProfile)
    .where(eq(candidateProfile.userId, userId))
    .limit(1)
  return fallback.trim() || row?.name?.trim() || "Candidate"
}

/**
 * Grades and stores a candidate's submission.
 *
 * Everything that ranking depends on is computed here, server-side, from the
 * stored assessment: MCQs deterministically, short answers via one structured
 * AI call (falling back to "requires review"), coding answers always manual.
 * Integrity and similarity evidence are recomputed too, so a client can never
 * post its own scores.
 */
export async function createSubmission(
  candidate: { id: string; name: string },
  input: SubmissionInput,
): Promise<AssessmentSubmission> {
  const assessmentRow = await getAssessmentRow(input.assessmentId)
  if (!assessmentRow || assessmentRow.status !== "published") throw new AssessmentNotFoundError()

  const assessmentValue = rowToAssessment(assessmentRow)
  const answers = input.answers

  let shortEvals: Record<string, ShortEval> = {}
  if (assessmentValue.questions.some((q) => q.type === "short")) {
    try {
      shortEvals = await evaluateShortAnswers({ assessment: assessmentValue, answers })
    } catch (err) {
      // AI unavailable: short answers stay "requires review" rather than guessed.
      console.log("[v0] short-answer evaluation failed:", err instanceof Error ? err.message : String(err))
      shortEvals = {}
    }
  }

  const result = gradeSubmission(assessmentValue, answers, shortEvals)

  const integrity = analyzeIntegrity({
    durationSeconds: input.durationSeconds,
    questionCount: assessmentValue.questions.length,
    submitAttempts: input.submitAttempts,
    pastedQuestionCount: input.pastedQuestionCount,
  })

  // Compare against every stored submission of the same assessment.
  const priorRows = await db
    .select()
    .from(submission)
    .where(eq(submission.assessmentId, assessmentRow.id))
  const similarity = analyzeSimilarity(assessmentValue, answers, priorRows.map(rowToSubmission))

  const candidateName = await resolveCandidateName(candidate.id, candidate.name)

  const [row] = await db
    .insert(submission)
    .values({
      id: `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      candidateUserId: candidate.id,
      assessmentId: assessmentRow.id,
      jobId: assessmentRow.jobId,
      assessmentTitle: assessmentRow.title,
      jobTitle: assessmentRow.jobTitle,
      company: assessmentRow.company,
      candidateName,
      result,
      answers,
      integrity,
      similarity,
      interview: input.interview ?? null,
    })
    .returning()

  return rowToSubmission(row)
}

/** The calling candidate's own submissions, newest first. */
export async function listCandidateSubmissions(candidateUserId: string): Promise<AssessmentSubmission[]> {
  const rows = await db
    .select()
    .from(submission)
    .where(eq(submission.candidateUserId, candidateUserId))
    .orderBy(desc(submission.submittedAt))
  return rows.map(rowToSubmission)
}

/**
 * Submissions a recruiter may see: only those against assessments they own.
 * The join is the authorization boundary.
 */
export async function listRecruiterSubmissions(recruiterUserId: string): Promise<AssessmentSubmission[]> {
  const rows = await db
    .select({ submission })
    .from(submission)
    .innerJoin(assessment, eq(submission.assessmentId, assessment.id))
    .where(eq(assessment.recruiterUserId, recruiterUserId))
    .orderBy(desc(submission.submittedAt))
  return rows.map(({ submission: s }) => rowToSubmission(s))
}

/** True when this submission belongs to an assessment owned by the recruiter. */
export async function recruiterOwnsSubmission(recruiterUserId: string, submissionId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: submission.id })
    .from(submission)
    .innerJoin(assessment, eq(submission.assessmentId, assessment.id))
    .where(and(eq(submission.id, submissionId), eq(assessment.recruiterUserId, recruiterUserId)))
    .limit(1)
  return Boolean(row)
}
