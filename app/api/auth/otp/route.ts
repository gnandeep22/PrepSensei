import { NextResponse } from "next/server"
import { pool } from "@/lib/db"
import { sendOtpEmail } from "@/lib/email"

export const runtime = "nodejs"

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const { action, email, otp, name, role = "candidate" } = body

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const identifier = `otp:${normalizedEmail}`

  if (action === "send") {
    try {
      // Check if user already exists
      const userCheck = await pool.query('SELECT id FROM "user" WHERE LOWER(email) = $1 LIMIT 1', [normalizedEmail])
      if (userCheck.rows.length > 0) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in instead." },
          { status: 400 },
        )
      }

      // Generate 4-digit OTP (matching Reference 1 orbital verification design)
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      const id = `otp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

      // Remove existing pending OTPs for this email and insert new one
      await pool.query('DELETE FROM "verification" WHERE identifier = $1', [identifier])
      await pool.query(
        'INSERT INTO "verification" ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW())',
        [id, identifier, generatedOtp, expiresAt],
      )

      // Send email via Gmail SMTP
      const emailResult = await sendOtpEmail({
        to: normalizedEmail,
        name: name || "",
        otp: generatedOtp,
        role: role === "recruiter" ? "recruiter" : "candidate",
      })

      if (!emailResult.sent) {
        return NextResponse.json(
          { error: emailResult.error || "Failed to send email through Gmail SMTP. Please check your SMTP settings." },
          { status: 500 },
        )
      }

      return NextResponse.json({
        success: true,
        message: `A 4-digit verification code was sent to ${normalizedEmail}. Please check your Gmail inbox.`,
      })
    } catch (err) {
      console.error("[OTP] Failed to send OTP:", err)
      return NextResponse.json({ error: "Failed to generate verification code. Please try again." }, { status: 500 })
    }
  }

  if (action === "verify") {
    if (!otp || typeof otp !== "string" || otp.trim().length < 4) {
      return NextResponse.json({ error: "Please enter the complete 4-digit verification code." }, { status: 400 })
    }

    try {
      const res = await pool.query(
        'SELECT * FROM "verification" WHERE identifier = $1 ORDER BY "createdAt" DESC LIMIT 1',
        [identifier],
      )

      if (res.rows.length === 0) {
        return NextResponse.json(
          { error: "No verification code found or it has already been used. Please request a new code." },
          { status: 400 },
        )
      }

      const record = res.rows[0]
      if (new Date(record.expiresAt) < new Date()) {
        await pool.query('DELETE FROM "verification" WHERE identifier = $1', [identifier])
        return NextResponse.json(
          { error: "Verification code has expired. Please request a new code." },
          { status: 400 },
        )
      }

      if (record.value !== otp.trim()) {
        return NextResponse.json(
          { error: "Incorrect verification code. Please check your email and try again." },
          { status: 400 },
        )
      }

      // Valid OTP: delete to prevent reuse
      await pool.query('DELETE FROM "verification" WHERE identifier = $1', [identifier])

      return NextResponse.json({
        success: true,
        verified: true,
      })
    } catch (err) {
      console.error("[OTP] Verification error:", err)
      return NextResponse.json({ error: "Failed to verify code. Please try again." }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
