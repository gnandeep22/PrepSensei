import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { db } from "@/lib/db"
import { candidateNotification } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    const { searchParams } = new URL(req.url)
    const candidateUserId = searchParams.get("candidateUserId")
    const targetUserId = user?.id || candidateUserId

    let rows
    if (targetUserId) {
      rows = await db
        .select()
        .from(candidateNotification)
        .where(eq(candidateNotification.userId, targetUserId))
        .orderBy(desc(candidateNotification.createdAt))
        .limit(30)
    } else {
      // Demo / preview mode fallback: return latest candidate notifications
      rows = await db
        .select()
        .from(candidateNotification)
        .orderBy(desc(candidateNotification.createdAt))
        .limit(30)
    }

    const unreadCount = rows.filter((r) => !r.read).length

    return NextResponse.json({ notifications: rows, unreadCount })
  } catch (error: any) {
    console.error("[candidate-notifications] GET Error:", error)
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    const { id, markAllRead, candidateUserId } = await req.json()
    const targetUserId = user?.id || candidateUserId

    if (markAllRead) {
      if (targetUserId) {
        await db
          .update(candidateNotification)
          .set({ read: true })
          .where(eq(candidateNotification.userId, targetUserId))
      } else {
        await db
          .update(candidateNotification)
          .set({ read: true })
      }
      return NextResponse.json({ success: true })
    }

    if (id) {
      await db
        .update(candidateNotification)
        .set({ read: true })
        .where(eq(candidateNotification.id, id))
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  } catch (error: any) {
    console.error("[candidate-notifications] POST Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
