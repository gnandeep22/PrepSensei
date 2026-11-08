import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { db } from "@/lib/db"
import { job as jobTable, assessment as assessmentTable } from "@/lib/db/schema"
import { desc, eq, or, like } from "drizzle-orm"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    const recruiterId = user?.id

    let jobs: any[] = []
    if (recruiterId) {
      jobs = await db
        .select()
        .from(jobTable)
        .where(
          or(
            eq(jobTable.createdBy, recruiterId),
            like(jobTable.id, "recruiter-job-%")
          )
        )
        .orderBy(desc(jobTable.createdAt))
    } else {
      jobs = await db
        .select()
        .from(jobTable)
        .where(like(jobTable.id, "recruiter-job-%"))
        .orderBy(desc(jobTable.createdAt))
    }

    return NextResponse.json({
      success: true,
      jobs,
    })
  } catch (err: any) {
    console.error("[GET /api/recruiter/jobs error]:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { jobId, evaluationCriteria } = body

    if (!jobId || !Array.isArray(evaluationCriteria)) {
      return NextResponse.json({ error: "jobId and evaluationCriteria array are required" }, { status: 400 })
    }

    // Verify job exists and recruiter is authorized
    const [existingJob] = await db.select().from(jobTable).where(eq(jobTable.id, jobId)).limit(1)
    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Authorization check: recruiter must own the job or have recruiter role
    if (existingJob.createdBy && existingJob.createdBy !== user.id && user.role !== "recruiter") {
      return NextResponse.json({ error: "Forbidden: You are not authorized to modify this job's criteria" }, { status: 403 })
    }

    // Validate criteria
    const sanitizedCriteria = evaluationCriteria
      .filter((c: any) => c && typeof c === "object" && Boolean(c.title?.trim()))
      .map((c: any, idx: number) => ({
        id: c.id ? String(c.id).trim() : `criterion_${idx + 1}`,
        title: String(c.title).trim(),
        description: c.description ? String(c.description).trim() : "Evaluate candidate competency.",
        keyAspects: Array.isArray(c.keyAspects) && c.keyAspects.length > 0
          ? c.keyAspects.map((k: any) => String(k).trim()).filter(Boolean)
          : [String(c.title).trim()],
        importance: (c.importance === "high" || c.importance === "medium" || c.importance === "low")
          ? c.importance
          : "medium",
      }))

    if (sanitizedCriteria.length === 0) {
      return NextResponse.json({ error: "At least one valid evaluation criterion is required" }, { status: 400 })
    }

    // Overwrite active criteria on job table
    await db
      .update(jobTable)
      .set({
        evaluationCriteria: sanitizedCriteria,
        updatedAt: new Date(),
      })
      .where(eq(jobTable.id, jobId))

    // Update corresponding assessment table row if one exists
    await db
      .update(assessmentTable)
      .set({
        evaluationCriteria: sanitizedCriteria,
        updatedAt: new Date(),
      })
      .where(eq(assessmentTable.jobId, jobId))

    return NextResponse.json({
      success: true,
      jobId,
      evaluationCriteria: sanitizedCriteria,
      message: "Evaluation criteria updated successfully",
    })
  } catch (err: any) {
    console.error("[PATCH /api/recruiter/jobs error]:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
