import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, getSessionActor } from "@/lib/session"
import { db } from "@/lib/db"
import { assessment, submission, interviewFaceAnalysis, user as userTable, hiringDecision, job, application } from "@/lib/db/schema"
import { and, desc, eq, inArray } from "drizzle-orm"
import { gradeSubmission, type ShortEval } from "@/lib/assessment/grade"
import { evaluateShortAnswers } from "@/lib/assessment/evaluate-agent"
import { analyzeIntegrity } from "@/lib/assessment/integrity"
import { analyzeSimilarity } from "@/lib/assessment/plagiarism"
import { demoAssessments, demoJobs, type AssessmentSubmission, type Assessment, type AssessmentQuestion } from "@/lib/demo-data"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const actor = await getSessionActor()
    const { searchParams } = new URL(req.url)
    const assessmentId = searchParams.get("assessmentId")

    let rows: any[]
    if (actor?.role === "recruiter") {
      let rawRows
      if (assessmentId) {
        rawRows = await db
          .select()
          .from(submission)
          .where(and(eq(submission.assessmentId, assessmentId), eq(submission.isPractice, false)))
          .orderBy(desc(submission.submittedAt))
      } else {
        rawRows = await db
          .select()
          .from(submission)
          .where(eq(submission.isPractice, false))
          .orderBy(desc(submission.submittedAt))
      }

      // Stage Gating: The recruiter only wants interview reports from candidates
      // who qualified in resume shortlisting (status is "shortlisted" or "advanced")
      const qualifiedApps = await db
        .select({ candidateUserId: application.candidateUserId, jobId: application.jobId, status: application.status })
        .from(application)
        .where(inArray(application.status, ["shortlisted", "advanced"]))

      const qualifiedSet = new Set(qualifiedApps.map((a) => `${a.candidateUserId}::${a.jobId}`))

      rows = rawRows.filter((s) => {
        // Strict isolation: Never show practice sessions to recruiters
        if (s.isPractice === true) return false
        // Include if candidate qualified in shortlisting for this job
        if (qualifiedSet.has(`${s.candidateUserId}::${s.jobId}`)) return true
        // Legacy demo submissions
        if (s.id.startsWith("sub-demo-") || s.candidateUserId === "candidate-demo") return true
        return false
      })
    } else if (actor?.user?.id) {
      rows = await db
        .select()
        .from(submission)
        .where(eq(submission.candidateUserId, actor.user.id))
        .orderBy(desc(submission.submittedAt))
    } else {
      rows = await db
        .select()
        .from(submission)
        .orderBy(desc(submission.submittedAt))
        .limit(20)
    }

    // Also fetch decisions for these submissions
    const submissionIds = rows.map((r) => r.id)
    let decisionsMap: Record<string, any> = {}
    if (submissionIds.length > 0) {
      const decisionRows = await db
        .select()
        .from(hiringDecision)
        .where(inArray(hiringDecision.submissionId, submissionIds))
      for (const d of decisionRows) {
        decisionsMap[d.submissionId] = d
      }
    }

    const formatted: AssessmentSubmission[] = rows.map((r) => ({
      id: r.id,
      candidateUserId: r.candidateUserId,
      assessmentId: r.assessmentId,
      assessmentTitle: r.assessmentTitle,
      jobId: r.jobId,
      jobTitle: r.jobTitle,
      company: r.company,
      candidateName: r.candidateName,
      submittedAt: r.submittedAt.toISOString(),
      result: r.result,
      answers: r.answers ?? {},
      isPractice: Boolean(r.isPractice),
      ...(r.integrity ? { integrity: r.integrity } : {}),
      ...(r.similarity ? { similarity: r.similarity } : {}),
      ...(r.interview ? { interview: r.interview } : {}),
    }))

    return NextResponse.json({ ok: true, submissions: formatted, decisions: decisionsMap })
  } catch (error: any) {
    console.error("[GET /api/submissions] Error:", error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    const body = await req.json()
    const {
      assessmentId,
      jobId,
      answers = {},
      durationSeconds = 120,
      interview,
      report,
    } = body

    if (!assessmentId && !jobId) {
      return NextResponse.json({ error: "assessmentId or jobId required" }, { status: 400 })
    }

    const candidateId = user?.id || `guest-${Date.now().toString(36)}`
    const candidateName = user?.name || "Candidate"
    const candidateEmail = user?.email || ""

    // 1. Locate the assessment
    let foundAssessment: Assessment | null = null
    let foundJobTitle = ""
    let foundCompany = ""

    if (assessmentId) {
      const [dbRow] = await db
        .select()
        .from(assessment)
        .where(eq(assessment.id, assessmentId))
        .limit(1)

      if (dbRow) {
        foundAssessment = {
          id: dbRow.id,
          title: dbRow.title,
          jobId: dbRow.jobId,
          jobTitle: dbRow.jobTitle,
          company: dbRow.company,
          difficulty: dbRow.difficulty,
          status: dbRow.status,
          questions: dbRow.questions ?? [],
          createdAt: dbRow.createdAt.toISOString(),
        }
        foundJobTitle = dbRow.jobTitle
        foundCompany = dbRow.company
      }
    }

    // Try finding by jobId in DB if not found yet
    if (!foundAssessment && jobId) {
      const [dbRow] = await db
        .select()
        .from(assessment)
        .where(eq(assessment.jobId, jobId))
        .limit(1)

      if (dbRow) {
        foundAssessment = {
          id: dbRow.id,
          title: dbRow.title,
          jobId: dbRow.jobId,
          jobTitle: dbRow.jobTitle,
          company: dbRow.company,
          difficulty: dbRow.difficulty,
          status: dbRow.status,
          questions: dbRow.questions ?? [],
          createdAt: dbRow.createdAt.toISOString(),
        }
        foundJobTitle = dbRow.jobTitle
        foundCompany = dbRow.company
      }
    }

    // Fall back to demo assessments
    if (!foundAssessment) {
      const demo = demoAssessments.find((a) => a.id === assessmentId || a.jobId === jobId)
      if (demo) {
        foundAssessment = demo
        foundJobTitle = demo.jobTitle
        foundCompany = demo.company
      } else {
        // Fallback demo job
        const j = demoJobs.find((x) => x.id === jobId) || demoJobs[0]
        foundJobTitle = j.title
        foundCompany = j.company
        foundAssessment = {
          id: `assess-${jobId || "gen"}`,
          title: `${foundJobTitle} Assessment`,
          jobId: j.id,
          jobTitle: foundJobTitle,
          company: foundCompany,
          difficulty: "Medium",
          status: "published",
          questions: [
            {
              id: "q-1",
              type: "short",
              skill: "General",
              difficulty: "Medium",
              question: `Describe your core experience relevant to ${foundJobTitle}.`,
              keyPoints: ["Relevance", "Clarity"],
            },
          ],
          createdAt: new Date().toISOString(),
        }
      }
    }

    // 2. Evaluate short answers
    let shortEvals: Record<string, ShortEval> = {}
    if (foundAssessment.questions.some((q) => q.type === "short")) {
      try {
        shortEvals = await evaluateShortAnswers({ assessment: foundAssessment, answers })
      } catch (err) {
        console.warn("[submissions] evaluateShortAnswers warning:", err)
        shortEvals = {}
      }
    }

    // 3. Compute score result
    let result = gradeSubmission(foundAssessment, answers, shortEvals)

    // If candidate had an AI interview evaluation, incorporate that into the overall score
    if (interview && typeof interview.overall === "number") {
      if (result.overallScore === null || result.overallScore === 0) {
        result = {
          ...result,
          overallScore: interview.overall,
          reviewStatus: interview.overall >= 70 ? "complete" : "pending_review",
        }
      }
    }

    // 4. Calculate integrity and similarity
    const integrity = analyzeIntegrity({
      durationSeconds,
      questionCount: foundAssessment.questions.length,
      submitAttempts: 1,
      pastedQuestionCount: 0,
    })

    const priorRows = await db
      .select()
      .from(submission)
      .where(eq(submission.assessmentId, foundAssessment.id))

    const priorFormatted: AssessmentSubmission[] = priorRows.map((r) => ({
      id: r.id,
      assessmentId: r.assessmentId,
      assessmentTitle: r.assessmentTitle,
      jobId: r.jobId,
      jobTitle: r.jobTitle,
      company: r.company,
      candidateName: r.candidateName,
      submittedAt: r.submittedAt.toISOString(),
      result: r.result,
      answers: r.answers ?? {},
    }))

    const similarity = analyzeSimilarity(foundAssessment, answers, priorFormatted)

    // Store candidate email inside answers for recruiter contact if available
    const augmentedAnswers = { ...answers, ...(candidateEmail ? { email: candidateEmail } : {}) }

    // Resolve candidate user and ensure row exists in user table
    let actualUserId = user?.id
    if (!actualUserId) {
      actualUserId = `guest-${Date.now().toString(36)}`
      try {
        await db
          .insert(userTable)
          .values({
            id: actualUserId,
            name: candidateName,
            email: candidateEmail || `${actualUserId}@guest.prepsensei.internal`,
            role: "candidate",
          })
          .onConflictDoNothing()
      } catch (e) {
        console.warn("[submissions] Guest user insert error:", e)
      }
    }

    // Strict isolation: Practice sessions MUST NOT appear in recruiter views.
    // An interview is ONLY marked official (isPractice = false) if:
    // 1. The client explicitly requested an official interview (body.isOfficial === true)
    // 2. The client did NOT mark body.isPractice === true
    // 3. The candidate actually has a shortlisted/advanced application in the database for this job
    let isOfficialQualified = false
    try {
      const appRow = await db
        .select()
        .from(application)
        .where(and(eq(application.candidateUserId, actualUserId), eq(application.jobId, foundAssessment.jobId)))
        .limit(1)

      if (appRow.length > 0 && (appRow[0].status === "shortlisted" || appRow[0].status === "advanced")) {
        isOfficialQualified = true
      }
    } catch {}

    const isPractice = body.isPractice === true || body.isOfficial !== true || !isOfficialQualified
    const submissionId = `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

    await db.insert(submission).values({
      id: submissionId,
      candidateUserId: actualUserId,
      assessmentId: foundAssessment.id,
      jobId: foundAssessment.jobId,
      assessmentTitle: foundAssessment.title,
      jobTitle: foundJobTitle,
      company: foundCompany,
      candidateName,
      result,
      answers: augmentedAnswers,
      integrity,
      similarity,
      interview: interview || null,
      isPractice,
    })

    // If this is a verified official interview submission, update candidate's application row
    if (!isPractice) {
      try {
        await db
          .update(application)
          .set({
            status: "advanced",
            reviewNote: `Completed Official AI Interview. Overall Score: ${result.overallScore ?? interview?.overall ?? "N/A"}/100`,
            updatedAt: new Date(),
          })
          .where(and(eq(application.candidateUserId, actualUserId), eq(application.jobId, foundAssessment.jobId)))
      } catch (appUpdateErr) {
        console.warn("[submissions] Failed to update application after official interview:", appUpdateErr)
      }
    }

    // 5. Store interview face analysis report if provided
    if (report && typeof report === "object") {
      try {
        const faceAnalysisId = crypto.randomUUID()
        await db.insert(interviewFaceAnalysis).values({
          id: faceAnalysisId,
          submissionId,
          candidateUserId: actualUserId,
          report,
        })
      } catch (err) {
        console.warn("[submissions] Failed to save linked face analysis:", err)
      }
    }

    const createdSubmission: AssessmentSubmission = {
      id: submissionId,
      candidateUserId: actualUserId,
      assessmentId: foundAssessment.id,
      assessmentTitle: foundAssessment.title,
      jobId: foundAssessment.jobId,
      jobTitle: foundJobTitle,
      company: foundCompany,
      candidateName,
      submittedAt: new Date().toISOString(),
      result,
      answers: augmentedAnswers,
      isPractice,
      integrity,
      similarity,
      interview: interview || undefined,
    }

    return NextResponse.json({
      ok: true,
      submission: createdSubmission,
      message: "Interview and assessment submission successfully saved!",
    })
  } catch (error: any) {
    console.error("[POST /api/submissions] Error:", error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
