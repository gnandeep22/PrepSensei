import { NextResponse } from "next/server"
import { demoCandidate, demoJobs } from "@/lib/demo-data"
import { generateFirstQuestion, evaluateAnswer } from "@/lib/interview/agent"
import type { InterviewRequest } from "@/lib/interview/protocol"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(req: Request) {
  let body: InterviewRequest
  try {
    body = (await req.json()) as InterviewRequest
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  // Prefer the full Job sent by the client (real JSearch results are not in
  // demoJobs); fall back to a demo job by id so older callers keep working.
  const job = body.job ?? demoJobs.find((j) => j.id === body.jobId) ?? demoJobs[0]
  const profile = body.profile ?? demoCandidate

  try {
    if (body.action === "start") {
      const result = await generateFirstQuestion({
        job,
        profile,
        type: body.type,
        screeningQuestions: body.screeningQuestions,
      })
      return NextResponse.json(result)
    }

    if (body.action === "answer") {
      const result = await evaluateAnswer({
        job,
        profile,
        type: body.type,
        qa: body.qa,
        screeningQuestions: body.screeningQuestions,
      })
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 })
  } catch (error) {
    // Do not leak API keys or raw server errors to the client.
    console.error("[v0] interview agent error:", error)
    return NextResponse.json(
      { error: "The AI interviewer is unavailable right now." },
      { status: 503 },
    )
  }
}
