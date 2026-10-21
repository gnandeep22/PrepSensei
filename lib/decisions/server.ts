import "server-only"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { hiringDecision } from "@/lib/db/schema"
import { recruiterOwnsSubmission } from "@/lib/submissions/server"
import type { HiringDecision } from "@/lib/demo-data"

export const decisionInputSchema = z.object({
  submissionId: z.string().min(1).max(120),
  status: z.enum(["undecided", "shortlisted", "advanced", "rejected"]),
  note: z.string().max(2000).optional(),
})

export type DecisionInput = z.infer<typeof decisionInputSchema>

export class NotOwnerError extends Error {
  constructor() {
    super("not_owner")
  }
}

/** Every decision this recruiter has recorded, keyed by submission id. */
export async function listDecisions(recruiterUserId: string): Promise<Record<string, HiringDecision>> {
  const rows = await db.select().from(hiringDecision).where(eq(hiringDecision.recruiterUserId, recruiterUserId))
  const out: Record<string, HiringDecision> = {}
  for (const row of rows) {
    out[row.submissionId] = {
      submissionId: row.submissionId,
      status: row.status,
      ...(row.note ? { note: row.note } : {}),
      decidedAt: row.decidedAt.toISOString(),
    }
  }
  return out
}

/**
 * Records — or clears, when the status is "undecided" — a hiring decision.
 * The recruiter must own the assessment behind the submission; the decision is
 * never derived automatically from a score.
 */
export async function setDecision(
  recruiterUserId: string,
  input: DecisionInput,
): Promise<HiringDecision | null> {
  const owns = await recruiterOwnsSubmission(recruiterUserId, input.submissionId)
  if (!owns) throw new NotOwnerError()

  if (input.status === "undecided") {
    await db.delete(hiringDecision).where(eq(hiringDecision.submissionId, input.submissionId))
    return null
  }

  const [row] = await db
    .insert(hiringDecision)
    .values({
      submissionId: input.submissionId,
      recruiterUserId,
      status: input.status,
      note: input.note ?? null,
    })
    .onConflictDoUpdate({
      target: hiringDecision.submissionId,
      set: {
        recruiterUserId,
        status: input.status,
        note: input.note ?? null,
        decidedAt: new Date(),
      },
    })
    .returning()

  return {
    submissionId: row.submissionId,
    status: row.status,
    ...(row.note ? { note: row.note } : {}),
    decidedAt: row.decidedAt.toISOString(),
  }
}
