import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { InterviewCapacityService } from "@/lib/interview/capacity-service"
import { db } from "@/lib/db"
import { interviewSession, job as jobTable } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

export const runtime = "nodejs"

/**
 * GET /api/interview/session?jobId=...
 * Retrieve existing server-authoritative interview session for candidate.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    const candidateUserId = user?.id || "demo-candidate"
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get("jobId")

    if (!jobId) {
      return NextResponse.json({ error: "jobId query param required" }, { status: 400 })
    }

    const [existing] = await db
      .select()
      .from(interviewSession)
      .where(
        and(
          eq(interviewSession.candidateUserId, candidateUserId),
          eq(interviewSession.jobId, jobId),
          eq(interviewSession.status, "in_progress")
        )
      )
      .limit(1)

    if (!existing) {
      // Look up job default duration so client knows before starting
      let durationMinutes = 15
      try {
        const [j] = await db
          .select({ duration: jobTable.interviewDurationMinutes })
          .from(jobTable)
          .where(eq(jobTable.id, jobId))
          .limit(1)
        if (j?.duration) durationMinutes = j.duration
      } catch {}

      return NextResponse.json({
        hasActiveSession: false,
        durationMinutes,
      })
    }

    const now = new Date()
    const remainingMs = existing.expiresAt.getTime() - now.getTime()
    const isExpired = remainingMs <= 0
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000))

    if (isExpired && existing.status === "in_progress") {
      await db
        .update(interviewSession)
        .set({ status: "expired", endedAt: now, updatedAt: now })
        .where(eq(interviewSession.id, existing.id))
    }

    return NextResponse.json({
      hasActiveSession: !isExpired,
      session: existing,
      durationMinutes: existing.durationMinutes,
      startedAt: existing.startedAt,
      expiresAt: existing.expiresAt,
      remainingSeconds,
      isExpired,
    })
  } catch (error: any) {
    console.error("[api/interview/session] GET error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch session" }, { status: 500 })
  }
}

/**
 * POST /api/interview/session
 * Initialize or resume server-authoritative interview session.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    const candidateUserId = user?.id || "demo-candidate"
    const body = await req.json().catch(() => ({}))
    const { jobId, assessmentId, durationMinutes } = body

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 })
    }

    const result = await InterviewCapacityService.createOrResumeSession({
      candidateUserId,
      jobId,
      assessmentId,
      requestedDurationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
    })

    return NextResponse.json({
      success: true,
      sessionId: result.session.id,
      durationMinutes: result.session.durationMinutes,
      startedAt: result.session.startedAt,
      expiresAt: result.session.expiresAt,
      remainingSeconds: result.remainingSeconds,
      isNew: result.isNew,
      isExpired: result.isExpired,
    })
  } catch (error: any) {
    console.error("[api/interview/session] POST error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to initialize interview session." },
      { status: 500 }
    )
  }
}
