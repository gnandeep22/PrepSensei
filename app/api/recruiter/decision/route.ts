import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { db } from "@/lib/db"
import { hiringDecision, candidateNotification, user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { sendDecisionEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  try {
    const recruiter = (await getSessionUser()) || {
      id: "recruiter-demo",
      name: "PrepSensei Hiring Partner",
      email: "prepsensei1@gmail.com",
      role: "recruiter",
    }

    const body = await req.json()
    const {
      submissionId,
      candidateUserId,
      candidateEmail,
      candidateName,
      jobTitle,
      company,
      status, // "shortlisted" | "advanced" | "rejected"
      subject,
      message,
      note,
    } = body

    if (!submissionId || !candidateUserId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 1. Upsert hiring decision in PostgreSQL
    const existing = await db
      .select()
      .from(hiringDecision)
      .where(eq(hiringDecision.submissionId, submissionId))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(hiringDecision)
        .set({
          status,
          note: note || null,
          decidedAt: new Date(),
        })
        .where(eq(hiringDecision.submissionId, submissionId))
    } else {
      await db.insert(hiringDecision).values({
        submissionId,
        recruiterUserId: recruiter.id,
        status,
        note: note || null,
      })
    }

    // 2. Fetch candidate account details
    // Prioritize the candidate's registered user account email and name over resume-parsed fields!
    let toEmail = candidateEmail
    let recipientName = candidateName || "Candidate"

    if (candidateUserId) {
      try {
        const candidateUser = await db
          .select()
          .from(userTable)
          .where(eq(userTable.id, candidateUserId))
          .limit(1)
        if (candidateUser.length > 0) {
          if (candidateUser[0].email) {
            toEmail = candidateUser[0].email
          }
          if (candidateUser[0].name) {
            recipientName = candidateUser[0].name
          }
        }
      } catch (uErr) {
        console.warn("[Candidate user lookup warning in decision]:", uErr)
      }
    }

    // 3. Send official notification email via Gmail SMTP
    let emailResult: { sent: boolean; error?: string } = { sent: false, error: "" }
    if (toEmail && subject && message) {
      emailResult = await sendDecisionEmail({
        to: toEmail,
        candidateName: recipientName,
        jobTitle: jobTitle || "Role",
        company: company || recruiter.name || "Hiring Team",
        status,
        subject,
        message,
      })
    }

    // 4. Create in-app notification in candidate dashboard
    const notifId = `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`
    const notifTitle =
      status === "shortlisted"
        ? `🎉 Shortlisted for ${jobTitle}!`
        : status === "advanced"
        ? `🚀 Advanced to Next Round for ${jobTitle}!`
        : `Application update for ${jobTitle}`

    const notifMessage =
      status === "shortlisted"
        ? `Congratulations! ${company} has shortlisted you for ${jobTitle}. Check your email for next interview round details.`
        : status === "advanced"
        ? `Great news! You have advanced to the next interview round for ${jobTitle} at ${company}. Check your email for scheduling instructions.`
        : `Thank you for taking the time to interview for ${jobTitle} at ${company}. Please check your email for the full update.`

    await db.insert(candidateNotification).values({
      id: notifId,
      userId: candidateUserId,
      title: notifTitle,
      message: notifMessage,
      type: status,
      jobTitle: jobTitle || "",
      company: company || "",
      read: false,
    })

    return NextResponse.json({
      success: true,
      emailSent: emailResult.sent,
      emailError: emailResult.error,
      notificationCreated: true,
      message: `Hiring decision recorded and notification delivered to candidate!`,
    })
  } catch (error: any) {
    console.error("[recruiter-decision] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to process decision" }, { status: 500 })
  }
}
