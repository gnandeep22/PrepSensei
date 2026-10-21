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
