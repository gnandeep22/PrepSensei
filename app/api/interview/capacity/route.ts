import { NextResponse } from "next/server"
import { getSessionActor } from "@/lib/session"
import { InterviewCapacityService } from "@/lib/interview/capacity-service"

export const runtime = "nodejs"

/**
 * GET /api/interview/capacity
 * Returns real-time dynamic Gemini API capacity metrics and maximum safe duration.
 */
export async function GET() {
  try {
    const actor = await getSessionActor()
    // In dev / demo mode, allow access so recruiters can explore capacity without login barrier
    if (process.env.NODE_ENV === "production" && (!actor || actor.role !== "recruiter")) {
      return NextResponse.json(
        { error: "Unauthorized. Recruiter privileges required to inspect interview API capacity." },
        { status: 403 }
      )
    }

    const report = await InterviewCapacityService.getCapacityReport()
    return NextResponse.json(report)
  } catch (error: any) {
    console.error("[api/interview/capacity] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to calculate interview capacity." },
      { status: 500 }
    )
  }
}
