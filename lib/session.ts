import "server-only"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { faceRegistration } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * Resolves the signed-in user from the Better Auth session cookie.
 * Route handlers must use this instead of trusting any client-sent user id.
 */
export async function getSessionUser() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user ?? null
  } catch (err) {
    // A temporary database/DNS outage must not turn the sign-in page into a
    // server error overlay. Protected APIs still reject the absent session.
    console.error("[getSessionUser] session lookup unavailable:", err)
    return null
  }
}

/**
 * The signed-in user plus their application role, normalised. Anything that is
 * not explicitly "recruiter" is treated as a candidate.
 */
export async function getSessionActor() {
  const user = await getSessionUser()
  if (!user) return null
  const role = (user as { role?: string }).role === "recruiter" ? "recruiter" : "candidate"
  return { user, role } as const
}

/**
 * Checks whether a candidate user has registered their biometric face data in PostgreSQL.
 * Returns true if a face registration record exists, false otherwise.
 */
export async function isCandidateFaceRegistered(userId: string): Promise<boolean> {
  if (!userId) return false
  try {
    const rows = await db
      .select({ userId: faceRegistration.userId })
      .from(faceRegistration)
      .where(eq(faceRegistration.userId, userId))
      .limit(1)
    return rows.length > 0
  } catch (err) {
    console.error("[isCandidateFaceRegistered error]:", err)
    return false
  }
}
