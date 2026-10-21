import "server-only"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { candidateProfile, type CandidateProfileRow } from "@/lib/db/schema"
import type { CandidateProfile } from "@/lib/demo-data"

export const educationSchema = z.object({
  degree: z.string().max(200).default(""),
  institution: z.string().max(200).default(""),
  years: z.string().max(80).default(""),
})

export const experienceSchema = z.object({
  title: z.string().max(200).default(""),
  company: z.string().max(200).default(""),
  years: z.string().max(80).default(""),
  highlights: z.array(z.string().max(600)).max(20).default([]),
})

export const projectSchema = z.object({
  name: z.string().max(200).default(""),
  description: z.string().max(1200).default(""),
  tech: z.array(z.string().max(60)).max(30).default([]),
})

export const candidateProfileSchema = z.object({
  name: z.string().max(200).default(""),
  title: z.string().max(200).default(""),
  email: z.string().max(320).default(""),
  phone: z.string().max(60).default(""),
  location: z.string().max(200).default(""),
  summary: z.string().max(4000).default(""),
  skills: z.array(z.string().max(60)).max(100).default([]),
  education: z.array(educationSchema).max(20).default([]),
  experience: z.array(experienceSchema).max(30).default([]),
  projects: z.array(projectSchema).max(30).default([]),
})

export type ProfilePayload = {
  profile: CandidateProfile
  resumeUploaded: boolean
  resumeFileName: string | null
}

function toPayload(row: CandidateProfileRow): ProfilePayload {
  return {
    profile: {
      name: row.name,
      title: row.title,
      email: row.email,
      phone: row.phone,
      location: row.location,
      summary: row.summary,
      skills: row.skills ?? [],
      education: row.education ?? [],
      experience: row.experience ?? [],
      projects: row.projects ?? [],
    },
    resumeUploaded: row.resumeUploaded,
    resumeFileName: row.resumeFileName,
  }
}

/**
 * Returns the caller's stored profile, creating an empty one seeded with their
 * account name/email the first time they visit.
 */
export async function getOrCreateProfile(
  userId: string,
  seed: { name?: string | null; email?: string | null },
): Promise<ProfilePayload> {
  const [existing] = await db.select().from(candidateProfile).where(eq(candidateProfile.userId, userId)).limit(1)
  if (existing) return toPayload(existing)

  const [created] = await db
    .insert(candidateProfile)
    .values({ userId, name: seed.name ?? "", email: seed.email ?? "" })
    .onConflictDoNothing()
    .returning()

  if (created) return toPayload(created)

  const [row] = await db.select().from(candidateProfile).where(eq(candidateProfile.userId, userId)).limit(1)
  return toPayload(row)
}

/** Writes the profile fields for the given user id (always the session user). */
export async function saveProfile(userId: string, profile: CandidateProfile): Promise<ProfilePayload> {
  const [row] = await db
    .insert(candidateProfile)
    .values({ userId, ...profile })
    .onConflictDoUpdate({
      target: candidateProfile.userId,
      set: { ...profile, updatedAt: new Date() },
    })
    .returning()
  return toPayload(row)
}

/** Persists a freshly parsed resume together with the profile it produced. */
export async function saveParsedResume(
  userId: string,
  fileName: string,
  profile: CandidateProfile,
): Promise<ProfilePayload> {
  const values = {
    userId,
    ...profile,
    resumeFileName: fileName,
    resumeUploaded: true,
    resumeParsedAt: new Date(),
  }
  const [row] = await db
    .insert(candidateProfile)
    .values(values)
    .onConflictDoUpdate({
      target: candidateProfile.userId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning()
  return toPayload(row)
}
