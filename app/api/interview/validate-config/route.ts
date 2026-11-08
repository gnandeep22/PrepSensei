import { NextRequest, NextResponse } from "next/server"
import { getSessionActor } from "@/lib/session"
import { InterviewCapacityService } from "@/lib/interview/capacity-service"

export const runtime = "nodejs"

/**
 * POST /api/interview/validate-config
 * Validate requested interview duration against live Gemini API quotas.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await getSessionActor()
    if (process.env.NODE_ENV === "production" && (!actor || actor.role !== "recruiter")) {
      return NextResponse.json(
        { error: "Unauthorized. Recruiter privileges required to configure interview durations." },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const durationMinutes = Number(body.durationMinutes)

    if (!durationMinutes || isNaN(durationMinutes)) {
      return NextResponse.json(
        { error: "A valid integer durationMinutes is required." },
        { status: 400 }
      )
    }

    const validation = await InterviewCapacityService.validateDuration(durationMinutes)

    if (!validation.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: validation.reason || `Selected duration of ${durationMinutes} minutes exceeds available Gemini capacity.`,
          maxSafeDurationMinutes: validation.maxSafeDurationMinutes,
          suggestedDurations: [5, 10, 15, Math.min(20, validation.maxSafeDurationMinutes)],
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      durationMinutes,
      maxSafeDurationMinutes: validation.maxSafeDurationMinutes,
      message: `Interview duration of ${durationMinutes} minutes is within safe Gemini capacity limits.`,
    })
  } catch (error: any) {
    console.error("[api/interview/validate-config] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to validate interview duration configuration." },
      { status: 500 }
    )
  }
}
