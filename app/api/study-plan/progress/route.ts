import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { db } from "@/lib/db"
import { candidateStudyProgress } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get("jobId")

    if (!user) {
      return NextResponse.json({ ok: true, progress: {} })
    }

    let rows
    if (jobId) {
      rows = await db
        .select()
        .from(candidateStudyProgress)
        .where(
          and(
            eq(candidateStudyProgress.userId, user.id),
            eq(candidateStudyProgress.jobId, jobId)
          )
        )
    } else {
      rows = await db
        .select()
        .from(candidateStudyProgress)
        .where(eq(candidateStudyProgress.userId, user.id))
    }

    const progress: Record<number, boolean> = {}
    for (const r of rows) {
      progress[r.week] = r.completed
    }

    return NextResponse.json({ ok: true, progress })
  } catch (err: any) {
    console.error("[GET /api/study-plan/progress error]:", err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    const body = await req.json()
    const { jobId, week, completed } = body

    if (!jobId || week === undefined) {
      return NextResponse.json({ error: "jobId and week are required" }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({
        ok: true,
        progress: { [week]: Boolean(completed) },
        isGuest: true,
      })
    }

    const weekNum = Number(week)
    const isCompleted = Boolean(completed)
    const recordId = `${user.id}::${jobId}::${weekNum}`

    await db
      .insert(candidateStudyProgress)
      .values({
        id: recordId,
        userId: user.id,
        jobId,
        week: weekNum,
        completed: isCompleted,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [candidateStudyProgress.userId, candidateStudyProgress.jobId, candidateStudyProgress.week],
        set: {
          completed: isCompleted,
          updatedAt: new Date(),
        },
      })

    // Return the updated progress map for this user and job
    const rows = await db
      .select()
      .from(candidateStudyProgress)
      .where(
        and(
          eq(candidateStudyProgress.userId, user.id),
          eq(candidateStudyProgress.jobId, jobId)
        )
      )

    const progress: Record<number, boolean> = {}
    for (const r of rows) {
      progress[r.week] = r.completed
    }

    return NextResponse.json({ ok: true, progress })
  } catch (err: any) {
    console.error("[POST /api/study-plan/progress error]:", err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
