import { NextResponse } from "next/server"
import { demoCandidate, demoJobs } from "@/lib/demo-data"
import { generateFirstQuestion, evaluateAnswer } from "@/lib/interview/agent"
import type { InterviewRequest } from "@/lib/interview/protocol"
import { getSessionUser } from "@/lib/session"
import { InterviewCapacityService } from "@/lib/interview/capacity-service"
import { db } from "@/lib/db"
import { interviewSession } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(req: Request) {
  let body: InterviewRequest
  try {
    body = (await req.json()) as InterviewRequest
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const user = await getSessionUser()
  const candidateUserId = user?.id || "demo-candidate"

  // Prefer full Job sent by client; fall back to demo jobs
  const job = body.job ?? demoJobs.find((j) => j.id === body.jobId) ?? demoJobs[0]
  const profile = body.profile ?? demoCandidate

  try {
    if (body.action === "start") {
      // 1. Create or resume server-authoritative interview session
      let sessionData: any = null
      let remainingSeconds = (job.interviewDurationMinutes || 15) * 60
      let interviewSessionId = body.interviewSessionId

      try {
        const sessionResult = await InterviewCapacityService.createOrResumeSession({
          candidateUserId,
          jobId: job.id,
          requestedDurationMinutes: body.durationMinutes || job.interviewDurationMinutes,
        })
        sessionData = sessionResult.session
        remainingSeconds = sessionResult.remainingSeconds
        interviewSessionId = sessionResult.session.id
      } catch (err: any) {
        // If quota is exhausted or critical, return 429 with retry-after
        return NextResponse.json(
          { error: err.message || "Interview capacity is temporarily unavailable." },
          { status: 429 }
        )
      }

      // 2. Generate opening question
      const result = await generateFirstQuestion({
        job,
        profile,
        type: body.type,
        screeningQuestions: body.screeningQuestions,
        interviewSessionId,
        candidateUserId,
      })

      return NextResponse.json({
        question: result.question,
        interviewSessionId,
        durationMinutes: sessionData?.durationMinutes || job.interviewDurationMinutes || 15,
        startedAt: sessionData?.startedAt?.toISOString(),
        expiresAt: sessionData?.expiresAt?.toISOString(),
        remainingSeconds,
      })
    }

    if (body.action === "answer") {
      let timeExpired = Boolean(body.timeExpired)
      let activeSession: any = null
      let remainingSeconds = 0

      // 1. Check server-side time authoritative validation
      try {
        let sessionQuery = db
          .select()
          .from(interviewSession)
          .where(
            body.interviewSessionId
              ? eq(interviewSession.id, body.interviewSessionId)
              : and(
                  eq(interviewSession.candidateUserId, candidateUserId),
                  eq(interviewSession.jobId, job.id),
                  eq(interviewSession.status, "in_progress")
                )
          )
          .limit(1)

        const [existing] = await sessionQuery
        if (existing) {
          activeSession = existing
          const now = Date.now()
          const expiresAtMs = existing.expiresAt.getTime()
          const remainingMs = expiresAtMs - now

          // 30-second network latency and in-flight answer transmission grace period
          if (remainingMs <= -30000) {
            timeExpired = true
          }
          remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000))

          // Update current turn counter
          await db
            .update(interviewSession)
            .set({ currentTurn: body.qa.length, updatedAt: new Date() })
            .where(eq(interviewSession.id, existing.id))
        }
      } catch (e) {
        console.warn("[interview route] Session lookup warning:", e)
      }

      // 2. Evaluate answer with server-authoritative time awareness
      const result = await evaluateAnswer({
        job,
        profile,
        type: body.type,
        qa: body.qa,
        screeningQuestions: body.screeningQuestions,
        interviewSessionId: body.interviewSessionId || activeSession?.id,
        candidateUserId,
        timeExpired,
        targetDurationMinutes: activeSession?.durationMinutes || job.interviewDurationMinutes || 15,
      })

      // 3. If finished, mark session completed in PostgreSQL
      if (result.finished && activeSession) {
        try {
          await db
            .update(interviewSession)
            .set({ status: "completed", endedAt: new Date(), updatedAt: new Date() })
            .where(eq(interviewSession.id, activeSession.id))
        } catch {}
      }

      return NextResponse.json({
        ...result,
        remainingSeconds,
        isExpired: timeExpired,
      })
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 })
  } catch (error: any) {
    console.error("[interview route error]:", error)
    return NextResponse.json(
      { error: "The AI interviewer is experiencing high load. Your progress is saved, please retry." },
      { status: 503 }
    )
  }
}
