import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { db } from "@/lib/db"
import { application, job as jobTable, candidateNotification, candidateProfile } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { computeMatch, demoJobs, type CandidateProfile, type Job } from "@/lib/demo-data"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ authenticated: false, hasApplied: false })
    }

    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get("jobId")

    if (jobId) {
      const rows = await db
        .select()
        .from(application)
        .where(and(eq(application.candidateUserId, user.id), eq(application.jobId, jobId)))
        .limit(1)

      if (rows.length > 0) {
        return NextResponse.json({
          authenticated: true,
          hasApplied: rows[0].status !== "saved",
          application: rows[0],
        })
      }
      return NextResponse.json({ authenticated: true, hasApplied: false, application: null })
    }

    // Return all applications for this candidate
    const all = await db
      .select()
      .from(application)
      .where(eq(application.candidateUserId, user.id))

    return NextResponse.json({ authenticated: true, applications: all })
  } catch (err: any) {
    console.error("[GET /api/jobs/apply error]:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Authentication required to apply" }, { status: 401 })
    }

    const body = await req.json()
    const {
      jobId,
      phone = "",
      coverNote = "",
      portfolioUrl = "",
      resumeText = "",
      resumeFileName = "",
    } = body

    // Always prioritize the authenticated user's registered account name and email
    const candidateName = user.name?.trim() || body.candidateName?.trim() || "Candidate"
    const candidateEmail = user.email?.trim() || body.candidateEmail?.trim() || ""

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 })
    }

    // 1. Locate Job details for notification and scoring
    let jobDetails: Job | null = null
    let isRecruiterTarget = false
    try {
      const dbJob = await db.select().from(jobTable).where(eq(jobTable.id, jobId)).limit(1)
      if (dbJob.length > 0) {
        isRecruiterTarget = true
        jobDetails = {
          id: dbJob[0].id,
          title: dbJob[0].title,
          company: dbJob[0].company,
          location: dbJob[0].location,
          type: dbJob[0].type as any,
          experience: dbJob[0].experience,
          salary: dbJob[0].salary,
          requiredSkills: (dbJob[0].requiredSkills as string[]) || [],
          description: dbJob[0].description,
          posted: dbJob[0].posted || "Recently",
          url: dbJob[0].url || undefined,
          source: "recruiter",
        }
      }
    } catch {}

    if (!isRecruiterTarget && (jobId.startsWith("recruiter-job-") || jobId === "python-backend-developer")) {
      isRecruiterTarget = true
    }

    if (!isRecruiterTarget) {
      return NextResponse.json(
        {
          error:
            "Direct applications are only accepted for roles published directly by recruiters on PrepSensei. External market listings are for informational discovery — please apply on the company's official website.",
        },
        { status: 400 }
      )
    }

    if (!jobDetails) {
      jobDetails = demoJobs.find((j) => j.id === jobId) || null
    }

    // 2. Fetch candidate profile for accurate match score computation
    let candidateSkills: string[] = []
    let fullProfile: any = null
    try {
      const profileRow = await db.select().from(candidateProfile).where(eq(candidateProfile.userId, user.id)).limit(1)
      if (profileRow.length > 0) {
        fullProfile = profileRow[0]
        candidateSkills = (profileRow[0].skills as string[]) || []
      }
    } catch {}

    let computedScore = 75
    if (jobDetails) {
      const tempCandidate: CandidateProfile = {
        name: candidateName,
        title: fullProfile?.title || "Candidate",
        email: candidateEmail,
        phone,
        location: fullProfile?.location || "",
        summary: coverNote || fullProfile?.summary || "",
        skills: candidateSkills.length > 0 ? candidateSkills : (resumeText ? resumeText.split(/\s+/).slice(0, 15) : ["Software Engineering"]),
        education: fullProfile?.education || [],
        experience: fullProfile?.experience || [],
        projects: fullProfile?.projects || [],
      }
      const matchResult = computeMatch(tempCandidate, jobDetails)
      computedScore = matchResult.score
    }

    // 3. Upsert into application table
    const existing = await db
      .select()
      .from(application)
      .where(and(eq(application.candidateUserId, user.id), eq(application.jobId, jobId)))
      .limit(1)

    let finalAppId: string
    if (existing.length > 0) {
      finalAppId = existing[0].id
      await db
        .update(application)
        .set({
          status: "applied",
          matchScore: computedScore,
          candidateName,
          candidateEmail,
          phone: phone || existing[0].phone,
          resumeText: resumeText || existing[0].resumeText,
          resumeFileName: resumeFileName || existing[0].resumeFileName,
          coverNote: coverNote || existing[0].coverNote,
          portfolioUrl: portfolioUrl || existing[0].portfolioUrl,
          updatedAt: new Date(),
        })
        .where(eq(application.id, existing[0].id))
    } else {
      finalAppId = `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      await db.insert(application).values({
        id: finalAppId,
        candidateUserId: user.id,
        jobId,
        status: "applied",
        matchScore: computedScore,
        candidateName,
        candidateEmail,
        phone,
        resumeText,
        resumeFileName,
        coverNote,
        portfolioUrl,
      })
    }

    // 4. Send In-App Notification to Candidate
    const jobTitle = jobDetails?.title || "Target Position"
    const company = jobDetails?.company || "Hiring Partner"
    const notifId = `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

    try {
      await db.insert(candidateNotification).values({
        id: notifId,
        userId: user.id,
        title: `Application Submitted: ${jobTitle}`,
        message: `Your resume and application for ${jobTitle} at ${company} have been successfully received. The recruiter will review applications with AI shortlisting.`,
        type: "info",
        jobTitle,
        company,
        read: false,
      })
    } catch (notifErr) {
      console.warn("[Apply notification warning]:", notifErr)
    }

    return NextResponse.json({
      success: true,
      applicationId: finalAppId,
      status: "applied",
      matchScore: computedScore,
      message: `Your application for ${jobTitle} at ${company} was submitted successfully!`,
    })
  } catch (err: any) {
    console.error("[POST /api/jobs/apply error]:", err)
    return NextResponse.json({ error: err.message || "Failed to submit application" }, { status: 500 })
  }
}
