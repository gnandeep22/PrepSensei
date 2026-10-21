import { NextResponse } from "next/server"
import { tailorCv, validateCv } from "@/lib/cv/agent"
import type { CandidateProfile, Job, TailoredCv } from "@/lib/demo-data"

export const runtime = "nodejs"
export const maxDuration = 30

type Body =
  | { action: "tailor"; job: Job; profile: CandidateProfile }
  | { action: "check"; profile: CandidateProfile; cv: TailoredCv }

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  try {
    if (body.action === "tailor") {
      if (!body.job || !body.profile) {
        return NextResponse.json({ error: "Select a job before tailoring your CV." }, { status: 400 })
      }
      const { tailored, fallback } = await tailorCv({ profile: body.profile, job: body.job })
      return NextResponse.json({ cv: tailored, fallback })
    }

    if (body.action === "check") {
      if (!body.profile || !body.cv) {
        return NextResponse.json({ error: "Tailor a CV before running the check." }, { status: 400 })
      }
      const { result, fallback } = await validateCv({ profile: body.profile, cv: body.cv })
      return NextResponse.json({ check: result, fallback })
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 })
  } catch (error) {
    // Do not leak API keys or raw server errors to the client.
    console.error("[v0] cv-tailor route error:", error)
    return NextResponse.json({ error: "The CV assistant is unavailable right now." }, { status: 503 })
  }
}
