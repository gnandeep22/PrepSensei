import { NextResponse } from "next/server"
import { getAllModelStatuses, getEligibleRacingModels } from "@/lib/ai/gemini-race"

export const runtime = "nodejs"

export async function GET() {
  try {
    const statuses = getAllModelStatuses()
    const eligible = getEligibleRacingModels()
    return NextResponse.json({
      statuses,
      availableCount: eligible.length,
      totalCount: statuses.length,
      timestamp: Date.now(),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch model statuses" }, { status: 500 })
  }
}
