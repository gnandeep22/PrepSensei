import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assessment as assessmentTable, job as jobTable } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { generateAssessment } from "@/lib/assessment/agent"
import { evaluateShortAnswers } from "@/lib/assessment/evaluate-agent"
import { gradeSubmission, type ShortEval } from "@/lib/assessment/grade"
import { demoJobs, demoAssessments, type Assessment, type AssessmentConfig, type Job } from "@/lib/demo-data"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get("jobId")
    const id = searchParams.get("id")

    if (jobId) {
      const [dbAssessment] = await db
        .select()
        .from(assessmentTable)
        .where(eq(assessmentTable.jobId, jobId))
        .limit(1)

      const [dbJob] = await db
        .select()
        .from(jobTable)
        .where(eq(jobTable.id, jobId))
        .limit(1)

      if (dbAssessment) {
        return NextResponse.json({
          ok: true,
          assessment: {
            id: dbAssessment.id,
            title: dbAssessment.title,
            jobId: dbAssessment.jobId,
            jobTitle: dbAssessment.jobTitle,
            company: dbAssessment.company,
            difficulty: dbAssessment.difficulty,
            status: dbAssessment.status,
            questions: dbAssessment.questions ?? [],
            createdAt: dbAssessment.createdAt.toISOString(),
          },
          job: dbJob ?? null,
        })
      }

      // Check demo assessments
      const demo = demoAssessments.find((a) => a.jobId === jobId)
      const demoJob = demoJobs.find((j) => j.id === jobId)
      if (demo) {
        return NextResponse.json({ ok: true, assessment: demo, job: demoJob ?? null })
      }

      return NextResponse.json({ ok: false, error: "Assessment not found" }, { status: 404 })
    }

    if (id) {
      const [dbAssessment] = await db
        .select()
        .from(assessmentTable)
        .where(eq(assessmentTable.id, id))
        .limit(1)

      if (dbAssessment) {
        return NextResponse.json({
          ok: true,
          assessment: {
            id: dbAssessment.id,
            title: dbAssessment.title,
            jobId: dbAssessment.jobId,
            jobTitle: dbAssessment.jobTitle,
            company: dbAssessment.company,
            difficulty: dbAssessment.difficulty,
            status: dbAssessment.status,
            questions: dbAssessment.questions ?? [],
            createdAt: dbAssessment.createdAt.toISOString(),
          },
        })
      }

      const demo = demoAssessments.find((a) => a.id === id)
      if (demo) {
        return NextResponse.json({ ok: true, assessment: demo })
      }

      return NextResponse.json({ ok: false, error: "Assessment not found" }, { status: 404 })
    }

    // List all published assessments from DB + demo
    const dbAssessments = await db
      .select()
      .from(assessmentTable)
      .where(eq(assessmentTable.status, "published"))
      .orderBy(desc(assessmentTable.createdAt))

    const mapped: Assessment[] = dbAssessments.map((a) => ({
      id: a.id,
      title: a.title,
      jobId: a.jobId,
      jobTitle: a.jobTitle,
      company: a.company,
      difficulty: a.difficulty,
      status: a.status,
      questions: a.questions ?? [],
      createdAt: a.createdAt.toISOString(),
    }))

    return NextResponse.json({
      ok: true,
      assessments: [...mapped, ...demoAssessments],
    })
  } catch (error: any) {
    console.error("[GET /api/assessment] Error:", error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}


type GenerateBody = { action: "generate"; config: AssessmentConfig; job?: Job | null }
type EvaluateBody = { action: "evaluate"; assessment: Assessment; answers: Record<string, string> }
type Body = GenerateBody | EvaluateBody

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  if (body.action === "evaluate") {
    return handleEvaluate(body)
  }

  if (body.action !== "generate") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 })
  }

  const config = body.config
  if (!config?.jobId || !config.questionTypes?.length) {
    return NextResponse.json({ error: "Select a job and at least one question type." }, { status: 400 })
  }

  // Prefer the passed Job object (e.g. a real JSearch result); fall back to a
  // matching demo job so the demo flow keeps working.
  const job = body.job ?? demoJobs.find((j) => j.id === config.jobId) ?? null
  if (!job) {
    return NextResponse.json({ error: "The selected job could not be found." }, { status: 400 })
  }

  try {
    const { questions, fallback } = await generateAssessment({ job, config })
    return NextResponse.json({ questions, fallback })
  } catch (error) {
    // Do not leak API keys or raw server errors to the client.
    console.error("[v0] assessment route error:", error)
    return NextResponse.json({ error: "The Assessment Agent is unavailable right now." }, { status: 503 })
  }
}

/**
 * Evaluate a submitted assessment. MCQs are graded deterministically. Short
 * answers use ONE structured AI call; if it fails they become "Requires Review"
 * (never fabricated). Coding answers always require manual review.
 */
async function handleEvaluate(body: EvaluateBody) {
  const { assessment, answers } = body
  if (!assessment?.questions?.length) {
    return NextResponse.json({ error: "A valid assessment is required." }, { status: 400 })
  }

  let shortEvals: Record<string, ShortEval> = {}
  const hasShort = assessment.questions.some((q) => q.type === "short")
  if (hasShort) {
    try {
      shortEvals = await evaluateShortAnswers({ assessment, answers: answers ?? {} })
    } catch (error) {
      // AI unavailable: leave short answers for manual review, still grade MCQs.
      console.error("[v0] assessment evaluate error:", error)
      shortEvals = {}
    }
  }

  const result = gradeSubmission(assessment, answers ?? {}, shortEvals)
  return NextResponse.json({ result })
}
