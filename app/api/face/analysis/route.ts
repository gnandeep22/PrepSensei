import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { interviewFaceAnalysis, faceRegistration } from "@/lib/db/schema"
import type { InterviewFaceReport } from "@/lib/db/schema"
import { getSessionUser, getSessionActor } from "@/lib/session"
import { eq } from "drizzle-orm"

export async function POST(req: NextRequest) {
  const user = (await getSessionUser()) || { id: "candidate-demo", name: "Candidate", email: "candidate@demo.com" }

  const body = await req.json()
  const { report, submissionId } = body as { report: InterviewFaceReport; submissionId?: string }

  if (!report || typeof report !== "object") {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 })
  }

  const id = crypto.randomUUID()
  await db.insert(interviewFaceAnalysis).values({
    id,
    submissionId: submissionId ?? null,
    candidateUserId: user.id,
    report,
  })

  return NextResponse.json({ ok: true, id })
}

export async function GET(req: NextRequest) {
  const actor = (await getSessionActor()) || {
    role: "recruiter" as const,
    user: { id: "recruiter-demo", name: "Recruiter", email: "prepsensei1@gmail.com" },
  }

  const { searchParams } = new URL(req.url)
  const submissionId = searchParams.get("submissionId")
  const candidateUserId = searchParams.get("candidateUserId")

  // Recruiters can query by submissionId or candidateUserId
  // Candidates can only query their own data
  let whereClause
  if (actor.role === "recruiter") {
    if (submissionId) {
      whereClause = eq(interviewFaceAnalysis.submissionId, submissionId)
    } else if (candidateUserId) {
      whereClause = eq(interviewFaceAnalysis.candidateUserId, candidateUserId)
    } else {
      return NextResponse.json({ error: "submissionId or candidateUserId required" }, { status: 400 })
    }
  } else {
    whereClause = eq(interviewFaceAnalysis.candidateUserId, actor.user.id)
  }

  const rows = await db.select().from(interviewFaceAnalysis).where(whereClause).limit(10)
  
  // For recruiter, also include face registration info
  let registration = null
  const targetUserId = candidateUserId || rows[0]?.candidateUserId
  if (actor.role === "recruiter" && targetUserId) {
    const regRows = await db.select({
      livenessVerified: faceRegistration.livenessVerified,
      smileDetected: faceRegistration.smileDetected,
      blinkDetected: faceRegistration.blinkDetected,
      registeredAt: faceRegistration.registeredAt,
      faceDescriptor: faceRegistration.faceDescriptor,
    }).from(faceRegistration).where(eq(faceRegistration.userId, targetUserId)).limit(1)

    if (regRows[0]) {
      const descObj = regRows[0].faceDescriptor as any
      registration = {
        livenessVerified: regRows[0].livenessVerified,
        smileDetected: regRows[0].smileDetected,
        blinkDetected: regRows[0].blinkDetected,
        registeredAt: regRows[0].registeredAt,
        photos: descObj && typeof descObj === "object" ? descObj.photos || null : null,
      }
    }
  }

  return NextResponse.json({ analyses: rows, registration })
}
