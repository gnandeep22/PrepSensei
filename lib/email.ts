import "server-only"
import nodemailer from "nodemailer"

export type SendOtpOptions = {
  to: string
  name: string
  otp: string
  role: "candidate" | "recruiter"
}

let transporter: any = null

function getTransporter(): any {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD

  if (user && pass && user.trim() && pass.trim()) {
    // Specifically use nodemailer's built-in Gmail preset
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: user.trim(),
        pass: pass.trim().replace(/\s+/g, ""), // Remove spaces in 16-character Google app passwords
      },
    })
  }

  // Fallback to custom SMTP host if configured
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: user.trim(),
        pass: pass.trim().replace(/\s+/g, ""),
      },
    })
  }

  return null
}

export async function sendOtpEmail(options: SendOtpOptions): Promise<{ sent: boolean; error?: string }> {
  const { to, name, otp, role } = options
  const roleLabel = role === "recruiter" ? "Recruiter" : "Candidate"
  const mailer = getTransporter()
  const fromUser = process.env.SMTP_USER || process.env.GMAIL_USER || "prepsensei@gmail.com"
  const from = `PrepSensei <${fromUser}>`

  // Server terminal log for tracking
  console.log(`\n======================================================`)
  console.log(`[PrepSensei Gmail OTP Verification]`)
  console.log(`To: ${to} (${name} - ${roleLabel})`)
  console.log(`Verification Code: ${otp}`)
  console.log(`Valid for: 10 minutes`)
  console.log(`======================================================\n`)

  if (!mailer) {
    console.warn("[PrepSensei Email] Gmail SMTP credentials missing in .env.local (SMTP_USER / SMTP_PASS).")
    return {
      sent: false,
      error: "Gmail SMTP is not configured. Please add SMTP_USER (your Gmail) and SMTP_PASS (your 16-char Gmail App Password) to .env.local.",
    }
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 6px; letter-spacing: 1px;">PREPSENSEI</h2>
        <p style="font-size: 13px; color: #6b7280; margin: 0;">AI-Guided Career & Technical Interview Platform</p>
      </div>
      <div style="border-top: 1px solid #f3f4f6; padding-top: 24px;">
        <p style="font-size: 15px; color: #374151; margin: 0 0 16px;">Hello <strong>${name || "there"}</strong>,</p>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 24px;">
          Thank you for signing up as a <strong>${roleLabel}</strong> on PrepSensei. To verify your email address and activate your account, please enter the following 4-digit code:
        </p>
        <div style="background: #f0fdf4; border: 1px dashed #16a34a; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 24px;">
          <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 700; letter-spacing: 10px; color: #15803d;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #6b7280; margin: 0 0 12px;">
          This verification code will expire in <strong>10 minutes</strong>.
        </p>
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
          If you did not initiate this request, please disregard this email.
        </p>
      </div>
    </div>
  `

  try {
    await mailer.sendMail({
      from,
      to,
      subject: `PrepSensei Email Verification Code: ${otp}`,
      text: `Hello ${name || ""},\n\nYour PrepSensei email verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nThank you,\nPrepSensei Team`,
      html,
    })
    console.log(`[PrepSensei Email] Successfully sent verification email via Gmail to ${to}`)
    return { sent: true }
  } catch (err: any) {
    console.error("[PrepSensei Email] Gmail SMTP sendMail failed:", err?.message || err)
    return {
      sent: false,
      error: `Failed to send email via Gmail: ${err?.message || "Authentication failed. Check your Gmail App Password."}`,
    }
  }
}

export type SendDecisionEmailOptions = {
  to: string
  candidateName: string
  jobTitle: string
  company: string
  status: "shortlisted" | "advanced" | "rejected"
  subject: string
  message: string
}

export async function sendDecisionEmail(options: SendDecisionEmailOptions): Promise<{ sent: boolean; error?: string }> {
  const { to, candidateName, jobTitle, company, status, subject, message } = options
  const mailer = getTransporter()
  const fromUser = process.env.SMTP_USER || process.env.GMAIL_USER || "prepsensei@gmail.com"
  const from = `PrepSensei Careers <${fromUser}>`

  console.log(`\n======================================================`)
  console.log(`[PrepSensei Recruiter Decision Email]`)
  console.log(`To: ${to} (${candidateName})`)
  console.log(`Job: ${jobTitle} at ${company}`)
  console.log(`Decision: ${status.toUpperCase()}`)
  console.log(`Subject: ${subject}`)
  console.log(`======================================================\n`)

  if (!mailer) {
    console.warn("[PrepSensei Email] Gmail SMTP credentials missing in .env.local (SMTP_USER / SMTP_PASS).")
    return {
      sent: false,
      error: "Gmail SMTP is not configured in .env.local.",
    }
  }

  const badgeColor =
    status === "shortlisted" ? "#16a34a" : status === "advanced" ? "#2563eb" : "#4b5563"
  const badgeBg =
    status === "shortlisted" ? "#f0fdf4" : status === "advanced" ? "#eff6ff" : "#f3f4f6"
  const statusLabel =
    status === "shortlisted" ? "Shortlisted" : status === "advanced" ? "Advanced to Next Round" : "Application Update"

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 6px; letter-spacing: 0.5px;">PREPSENSEI CAREERS</h2>
        <p style="font-size: 13px; color: #6b7280; margin: 0;">Application Status Update · ${company}</p>
      </div>

      <div style="border-top: 1px solid #f3f4f6; padding-top: 24px;">
        <div style="display: inline-block; background: ${badgeBg}; border: 1px solid ${badgeColor}; border-radius: 9999px; padding: 4px 14px; margin-bottom: 18px;">
          <span style="font-size: 13px; font-weight: 600; color: ${badgeColor};">${statusLabel}</span>
        </div>

        <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px;">
          ${jobTitle}
        </h3>

        <div style="font-size: 15px; color: #374151; line-height: 1.65; white-space: pre-line; margin-bottom: 24px;">
${message}
        </div>

        <div style="border-top: 1px solid #f3f4f6; padding-top: 18px; margin-top: 24px;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px;">
            This email was sent on behalf of <strong>${company}</strong> via the PrepSensei recruitment portal.
          </p>
          <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            Log in to your PrepSensei candidate dashboard at <a href="http://localhost:3000" style="color: #2563eb; text-decoration: none;">localhost:3000</a> to view complete updates.
          </p>
        </div>
      </div>
    </div>
  `

  try {
    await mailer.sendMail({
      from,
      to,
      subject,
      text: `Hello ${candidateName},\n\nUpdate regarding your application for ${jobTitle} at ${company}:\n\n${message}\n\nBest regards,\n${company} Hiring Team`,
      html,
    })
    console.log(`[PrepSensei Email] Successfully sent decision email via Gmail to ${to}`)
    return { sent: true }
  } catch (err: any) {
    console.error("[PrepSensei Email] sendMail failed:", err?.message || err)
    return {
      sent: false,
      error: `Failed to deliver email: ${err?.message || "Check Gmail SMTP credentials."}`,
    }
  }
}

