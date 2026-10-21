import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { db } from "@/lib/db"
import { application, job as jobTable, candidateNotification, user as userTable } from "@/lib/db/schema"
import { and, desc, eq, inArray } from "drizzle-orm"
import { sendDecisionEmail } from "@/lib/email"
import { demoJobs } from "@/lib/demo-data"
import { ensureSampleApplications } from "@/lib/applications/server"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const recruiter = await getSessionUser()
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get("jobId")

    let appsQuery = db.select().from(application).orderBy(desc(application.createdAt))
    let apps = jobId
      ? await db.select().from(application).where(eq(application.jobId, jobId)).orderBy(desc(application.createdAt))
      : await appsQuery

    // If query is for a specific job and 0 applications exist, seed 3 sample applications
    // so the recruiter can immediately test the 3-candidate shortlisting workflow described in the prompt!
    if (jobId && apps.length === 0) {
      apps = await ensureSampleApplications(jobId)
    }

    return NextResponse.json({
      success: true,
      applications: apps,
      total: apps.length,
    })
  } catch (err: any) {
    console.error("[GET /api/recruiter/applications error]:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const recruiter = (await getSessionUser()) || {
      id: "recruiter-partner",
      name: "PrepSensei Hiring Team",
      email: "hiring@prepsensei.com",
    }

    const body = await req.json()
    // Accepts single decision or batch decisions
    const decisions: Array<{
      applicationId: string
      status: "shortlisted" | "advanced" | "rejected"
      note?: string
    }> = body.decisions || [
      {
        applicationId: body.applicationId,
        status: body.status,
        note: body.note,
      },
    ]

    if (!decisions.length || !decisions[0].applicationId) {
      return NextResponse.json({ error: "Missing applicationId or decisions payload" }, { status: 400 })
    }

    const results: any[] = []

    for (const item of decisions) {
      const { applicationId, status, note } = item
      if (!applicationId || !status) continue

      // 1. Fetch application details
      const appRows = await db
        .select()
        .from(application)
        .where(eq(application.id, applicationId))
        .limit(1)

      if (appRows.length === 0) continue
      const app = appRows[0]

      // 2. Fetch Job title & company
      let jobTitle = "Open Position"
      let company = recruiter.name || "PrepSensei Hiring Partner"
      try {
        const jobRow = await db.select().from(jobTable).where(eq(jobTable.id, app.jobId)).limit(1)
        if (jobRow.length > 0) {
          jobTitle = jobRow[0].title
          company = jobRow[0].company
        } else {
          const dJob = demoJobs.find((j) => j.id === app.jobId)
          if (dJob) {
            jobTitle = dJob.title
            company = dJob.company
          }
        }
      } catch {}

      // 3. Resolve candidate account email & name
      // Always prioritize the candidate's verified sign-up/login account email and name over resume-parsed text!
      let toEmail = app.candidateEmail || "candidate@example.com"
      let candidateName = app.candidateName || "Candidate"

      if (app.candidateUserId) {
        try {
          const userRow = await db
            .select()
            .from(userTable)
            .where(eq(userTable.id, app.candidateUserId))
            .limit(1)
          if (userRow.length > 0) {
            if (userRow[0].email) toEmail = userRow[0].email
            if (userRow[0].name) candidateName = userRow[0].name
          }
        } catch (uErr) {
          console.warn("[Candidate user lookup warning]:", uErr)
        }
      }

      // 4. Update application in DB (also synchronizing candidateEmail and candidateName to account)
      await db
        .update(application)
        .set({
          status,
          reviewNote: note || null,
          candidateEmail: toEmail,
          candidateName,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(application.id, applicationId))

      // 5. Send Email Announcement to Candidate

      let emailSubject = ""
      let emailMessage = ""

      if (status === "advanced") {
        emailSubject = `🚀 Congratulations! You've been advanced to the AI Interview for ${jobTitle}`
        emailMessage = `Dear ${candidateName},\n\nWe are delighted to inform you that your resume and profile for ${jobTitle} at ${company} have successfully passed our resume screening round.\n\nYou have been advanced to the AI Technical Interview Round!\n\nPlease log in to your PrepSensei candidate portal to take your verified AI interview session:\nhttp://localhost:3000/interview/official?jobId=${app.jobId}&applicationId=${app.id}\n\n${note ? `Note from Recruiter: "${note}"\n\n` : ""}Best regards,\n${company} Hiring Team`
      } else if (status === "shortlisted") {
        emailSubject = `🎉 Application Update: Shortlisted for ${jobTitle} at ${company}`
        emailMessage = `Dear ${candidateName},\n\nCongratulations! Your application and resume for ${jobTitle} at ${company} have been shortlisted by our recruiting team.\n\nOur hiring managers are conducting comparative review. If advanced to the technical interview, you will receive next steps.\n\n${note ? `Note from Recruiter: "${note}"\n\n` : ""}Best regards,\n${company} Hiring Team`
      } else {
        emailSubject = `Application Update: ${jobTitle} at ${company}`
        emailMessage = `Dear ${candidateName},\n\nThank you for applying to the ${jobTitle} position at ${company}. After careful evaluation of all applicants, we have decided not to advance your application for this specific opening.\n\nWe encourage you to continue preparing and practicing on PrepSensei, and we wish you success in your job search.\n\n${note ? `Feedback: "${note}"\n\n` : ""}Best regards,\n${company} Hiring Team`
      }

      let emailRes = { sent: false }
      try {
        emailRes = await sendDecisionEmail({
          to: toEmail,
          candidateName,
          jobTitle,
          company,
          status,
          subject: emailSubject,
          message: emailMessage,
        })
      } catch (err) {
        console.warn("[Email dispatch warning]:", err)
      }

      // 5. Create In-App Notification in Candidate Portal
      const notifId = `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const notifTitle =
        status === "advanced"
          ? `🚀 Advanced to AI Interview Round for ${jobTitle}!`
          : status === "shortlisted"
          ? `🎉 Shortlisted for ${jobTitle} at ${company}`
          : `Application update for ${jobTitle}`

      const notifBody =
        status === "advanced"
          ? `Congratulations! ${company} has reviewed your resume and advanced you to the AI Technical Interview round. Take your official interview: /interview/official?jobId=${app.jobId}&applicationId=${app.id}`
          : status === "shortlisted"
          ? `Great news! Your resume has been shortlisted for ${jobTitle} at ${company}.`
          : `Thank you for applying for ${jobTitle} at ${company}. Your application status has been updated.`

      try {
        await db.insert(candidateNotification).values({
          id: notifId,
          userId: app.candidateUserId,
          title: notifTitle,
          message: notifBody,
          type: status,
          jobTitle,
          company,
          read: false,
        })
      } catch (notifErr) {
        console.warn("[In-app notification warning]:", notifErr)
      }

      results.push({
        applicationId,
        candidateName,
        status,
        emailSent: emailRes.sent,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} candidate decision(s) and dispatched announcements.`,
      results,
    })
  } catch (err: any) {
    console.error("[POST /api/recruiter/applications error]:", err)
    return NextResponse.json({ error: err.message || "Failed to record decisions" }, { status: 500 })
  }
}
