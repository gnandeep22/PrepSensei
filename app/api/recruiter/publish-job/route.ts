import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { db } from "@/lib/db"
import { job, assessment, user as userTable } from "@/lib/db/schema"
import { InterviewCapacityService } from "@/lib/interview/capacity-service"

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
      evaluationCriteria = [],
      interviewQuestions = [],
      interviewDurationMinutes = 15,
    } = body

    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 })
    }

    // Sanitize and validate evaluation criteria
    let sanitizedCriteria = Array.isArray(evaluationCriteria)
      ? evaluationCriteria
          .filter((c: any) => c && typeof c === "object" && Boolean(c.title?.trim()))
          .map((c: any, idx: number) => ({
            id: c.id ? String(c.id).trim() : `criterion_${idx + 1}`,
            title: String(c.title).trim(),
            description: c.description ? String(c.description).trim() : "Evaluate candidate capability in this area.",
            keyAspects: Array.isArray(c.keyAspects) && c.keyAspects.length > 0
              ? c.keyAspects.map((k: any) => String(k).trim()).filter(Boolean)
              : [String(c.title).trim()],
            importance: (c.importance === "high" || c.importance === "medium" || c.importance === "low")
              ? c.importance
              : "medium",
          }))
      : []

    // If no criteria provided (legacy or older payload), generate from requiredSkills or interviewQuestions
    if (sanitizedCriteria.length === 0) {
      if (Array.isArray(interviewQuestions) && interviewQuestions.length > 0) {
        sanitizedCriteria = interviewQuestions.map((q: any, idx: number) => ({
          id: `criterion_${idx + 1}`,
          title: q.skill || `Dimension ${idx + 1}`,
          description: q.question || "Evaluate candidate competency in this technical area.",
          keyAspects: Array.isArray(q.keyPoints) && q.keyPoints.length > 0 ? q.keyPoints : [q.skill || "Technical"],
          importance: idx === 0 ? "high" : "medium",
        }))
      } else {
        const skillsList = Array.isArray(requiredSkills) && requiredSkills.length > 0 ? requiredSkills : ["Core Engineering"]
        sanitizedCriteria = skillsList.slice(0, 5).map((skill: string, idx: number) => ({
          id: `criterion_${idx + 1}`,
          title: `${skill} & Architecture`,
          description: `Assess candidate's depth and practical experience with ${skill}.`,
          keyAspects: [skill, "Best practices", "Problem solving"],
          importance: idx === 0 ? "high" : "medium",
        }))
      }
    }

    const durationNum = Number(interviewDurationMinutes) || 15
    const validation = await InterviewCapacityService.validateDuration(durationNum)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.reason || `Selected duration (${durationNum}m) exceeds available Gemini API capacity.`,
          maxSafeDurationMinutes: validation.maxSafeDurationMinutes,
        },
        { status: 400 }
      )
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
      interviewDurationMinutes: durationNum,
      evaluationCriteria: sanitizedCriteria,
      createdBy: user.id,
    })

    // 2. Format assessment questions for backward compatibility if questions array is read
    const formattedQuestions = (interviewQuestions && interviewQuestions.length > 0)
      ? interviewQuestions.map((q: any, idx: number) => ({
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
      : sanitizedCriteria.map((c: any, idx: number) => ({
          id: `q-${idx + 1}`,
          type: "short" as const,
          skill: c.keyAspects[0] || c.title,
          difficulty: "Medium" as const,
          question: `Can you discuss your practical experience with ${c.title}?`,
          options: [],
          correctIndex: 0,
          explanation: "",
          keyPoints: c.keyAspects,
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
      evaluationCriteria: sanitizedCriteria,
    })

    return NextResponse.json({
      success: true,
      jobId,
      assessmentId,
      evaluationCriteria: sanitizedCriteria,
      message: "Job and AI Interview successfully published to Candidate Portal!",
    })
  } catch (error: any) {
    console.error("[publish-job] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to publish job" }, { status: 500 })
  }
}
