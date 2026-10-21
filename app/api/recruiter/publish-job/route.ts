import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { db } from "@/lib/db"
import { job, assessment, user as userTable } from "@/lib/db/schema"

export async function POST(req: NextRequest) {
  try {
    const user = (await getSessionUser()) || {
      id: "recruiter-demo",
      name: "PrepSensei Hiring Partner",
      email: "prepsensei1@gmail.com",
      role: "recruiter",
    }

    const body = await req.json()
    const {
      title,
      company,
      location,
      type = "Full-time",
      experience,
      salary,
      requiredSkills = [],
      description,
      interviewQuestions = [],
    } = body

    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 })
    }

    // Ensure recruiter exists in user table so foreign keys in job and assessment succeed
    try {
      await db
        .insert(userTable)
        .values({
          id: user.id,
          name: user.name || "PrepSensei Hiring Partner",
          email: user.email || "prepsensei1@gmail.com",
          role: "recruiter",
        })
        .onConflictDoNothing()
    } catch {
      // User might already exist
    }

    const jobId = `recruiter-job-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`
    const assessmentId = `assess-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`

    // 1. Insert job into PostgreSQL
    await db.insert(job).values({
      id: jobId,
      source: "demo", // Stored in DB table
      title: title.trim(),
      company: (company || user.name || "Hiring Partner").trim(),
      location: (location || "Remote").trim(),
      type: type as any,
      experience: (experience || "Not specified").trim(),
      salary: (salary || "Competitive").trim(),
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
      description: description.trim(),
      posted: "Just now",
      createdBy: user.id,
    })

    // 2. Format assessment questions for the candidate interview
    const formattedQuestions = (interviewQuestions || []).map((q: any, idx: number) => ({
      id: `q-${idx + 1}`,
      type: "short" as const,
      skill: q.skill || "Technical",
      difficulty: "Medium" as const,
      question: q.question,
      options: [],
      correctIndex: 0,
      explanation: "",
      keyPoints: Array.isArray(q.keyPoints) ? q.keyPoints : [],
    }))

    // 3. Create published assessment linked to this job
    await db.insert(assessment).values({
      id: assessmentId,
      recruiterUserId: user.id,
      jobId,
      title: `${title.trim()} Technical Screening`,
      jobTitle: title.trim(),
      company: (company || user.name || "Hiring Partner").trim(),
      difficulty: "Medium",
      status: "published",
      questions: formattedQuestions,
    })

    return NextResponse.json({
      success: true,
      jobId,
      assessmentId,
      message: "Job and AI Interview successfully published to Candidate Portal!",
    })
  } catch (error: any) {
    console.error("[publish-job] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to publish job" }, { status: 500 })
  }
}
