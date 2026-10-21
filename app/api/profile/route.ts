import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { candidateProfileSchema, getOrCreateProfile, saveProfile } from "@/lib/profile/server"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 })

  try {
    const payload = await getOrCreateProfile(user.id, { name: user.name, email: user.email })
    return NextResponse.json({ ok: true, ...payload })
  } catch (err) {
    console.log("[v0] profile GET failed:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 })
  }

  const parsed = candidateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid_profile" }, { status: 400 })
  }

  try {
    // Ownership comes from the session user id only.
    const payload = await saveProfile(user.id, parsed.data)
    return NextResponse.json({ ok: true, ...payload })
  } catch (err) {
    console.log("[v0] profile PUT failed:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 })
  }
}
