import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { generateJobFromPrompt } from "@/lib/jobs/agentic-jd"

export async function POST(req: NextRequest) {
  try {
    const user = (await getSessionUser()) || {
      id: "recruiter-demo",
      name: "PrepSensei Hiring Partner",
      email: "prepsensei1@gmail.com",
      role: "recruiter",
    }

    const body = await req.json()
    const { prompt, company } = body

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
      return NextResponse.json({ error: "Please provide a job prompt with at least a few keywords or requirements." }, { status: 400 })
    }

    const draft = await generateJobFromPrompt(
      prompt.trim(),
      company || (user?.name && !user.name.includes("Hiring Partner") ? user.name : undefined)
    )
    return NextResponse.json({ success: true, draft })
  } catch (error: any) {
    console.error("[generate-job] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to generate job draft" }, { status: 500 })
  }
}
