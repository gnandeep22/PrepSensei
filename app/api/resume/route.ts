import { NextResponse } from "next/server"
import { parseResumeText } from "@/lib/resume/parse"
import { getSessionUser } from "@/lib/session"
import { saveParsedResume } from "@/lib/profile/server"
import { getChatModel } from "@/lib/ai/model"
import { generateText, generateObject } from "ai"
import { z } from "zod"
import type { CandidateProfile } from "@/lib/demo-data"

export const runtime = "nodejs"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB limit

const candidateProfileSchema = z.object({
  name: z.string().describe("Candidate's full name").default(""),
  title: z.string().describe("Current or target professional job title/headline").default(""),
  email: z.string().describe("Email address").default(""),
  phone: z.string().describe("Phone number").default(""),
  location: z.string().describe("City, Country or Remote").default(""),
  summary: z.string().describe("Brief professional summary or bio").default(""),
  skills: z.array(z.string()).describe("Technical and domain skills, programming languages, frameworks, databases, tools").default([]),
  experience: z.array(
    z.object({
      title: z.string().describe("Job title"),
      company: z.string().describe("Company or organization name").default(""),
      years: z.string().describe("Duration, e.g. 2021 - Present or 2019 - 2021").default(""),
      highlights: z.array(z.string()).describe("Key accomplishments or responsibilities").default([]),
    })
  ).default([]),
  education: z.array(
    z.object({
      degree: z.string().describe("Degree and field of study, e.g. B.S. in Computer Science"),
      institution: z.string().describe("University or college name").default(""),
      years: z.string().describe("Graduation year or date range").default(""),
    })
  ).default([]),
  projects: z.array(
    z.object({
      name: z.string().describe("Project name"),
      description: z.string().describe("Brief description of what was built and impact").default(""),
      technologies: z.array(z.string()).describe("Tech stack used in project").default([]),
    })
  ).default([]),
})

async function extractTextWithLocalParsers(fileName: string, buffer: Buffer): Promise<string> {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".pdf")) {
    try {
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      try {
        const result = await parser.getText()
        if (result.text && result.text.replace(/\s/g, "").length >= 80) {
          return result.text
        }
      } finally {
        await parser.destroy().catch(() => {})
      }
    } catch (err) {
      console.warn("[resume] Local pdf-parse error, will try Gemini OCR:", err)
    }
  }

  if (lower.endsWith(".docx")) {
    try {
      const mammoth = (await import("mammoth")).default
      const result = await mammoth.extractRawText({ buffer })
      return result.value ?? ""
    } catch (err) {
      console.warn("[resume] Mammoth docx extraction error:", err)
    }
  }

  return ""
}

async function extractTextWithGeminiOcr(buffer: Buffer, mimeType: string): Promise<string> {
  const prompt = `You are a high-accuracy Document OCR Engine for resumes and CVs.
Extract all plain text content from this document accurately.
Preserve all candidate details: full name, contact information (email, phone, location, LinkedIn/GitHub), professional summary, work experience (job titles, companies, dates, bullet points), education, and all technical skills.
Output ONLY the raw extracted plain text with natural line breaks. Do not include introductory remarks or markdown blocks.`

  try {
    const { text } = await generateText({
      model: getChatModel("gemini-3.5-flash-lite"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "file", data: buffer, mediaType: mimeType },
          ],
        },
      ],
      maxRetries: 1,
    })
    return text || ""
  } catch (primaryErr) {
    console.warn("[resume] Gemini 3.5 OCR failed, trying Gemini 3.1 fallback:", primaryErr)
    try {
      const { text } = await generateText({
        model: getChatModel("gemini-3.1-flash-lite"),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "file", data: buffer, mediaType: mimeType },
            ],
          },
        ],
        maxRetries: 1,
      })
      return text || ""
    } catch (fallbackErr) {
      console.error("[resume] All Gemini OCR models failed:", fallbackErr)
      return ""
    }
  }
}

async function parseProfileWithAiFallback(rawText: string): Promise<CandidateProfile | null> {
  const prompt = `You are an expert Resume Parser and Career Data Analyst.
Parse the following extracted resume text into a clean, structured candidate profile object.
Make sure to extract all programming languages, tools, frameworks, and technologies into the 'skills' list.

Resume Text:
${rawText}`

  try {
    const { object } = await generateObject({
      model: getChatModel("gemini-3.5-flash-lite"),
      schema: candidateProfileSchema,
      prompt,
      maxRetries: 1,
    })
    return object as unknown as CandidateProfile
  } catch (err) {
    console.warn("[resume] AI structured parse failed, falling back to regex parser:", err)
    return null
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, reason: "no_file" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, reason: "too_large" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = file.name || "resume.pdf"
    const lower = fileName.toLowerCase()

    let text = await extractTextWithLocalParsers(fileName, buffer)

    // If local parser returned minimal text or empty (e.g. scanned image PDF, Canva design, non-standard fonts),
    // automatically trigger the Gemini Multimodal OCR pipeline
    if (text.replace(/\s/g, "").length < 80 && (lower.endsWith(".pdf") || file.type.includes("pdf"))) {
      console.log(`[resume] Local parser yielded low text (${text.length} chars). Invoking Gemini Multimodal OCR...`)
      const ocrText = await extractTextWithGeminiOcr(buffer, "application/pdf")
      if (ocrText && ocrText.replace(/\s/g, "").length >= 40) {
        text = ocrText
      }
    }

    // Require a reasonable amount of text; if even OCR found nothing, return informative error
    if (text.replace(/\s/g, "").length < 40) {
      return NextResponse.json({ ok: false, reason: "no_text" }, { status: 200 })
    }

    // First attempt deterministic regex parsing
    let profile: CandidateProfile = parseResumeText(text)

    // If deterministic regex missed core fields (e.g., unusual section headings or two-column layout),
    // use Gemini AI structured parser to accurately populate the profile
    if ((profile.skills.length < 2 && profile.experience.length === 0) || !profile.name) {
      console.log("[resume] Regex parser returned sparse fields. Enhancing with AI structured parser...")
      const aiProfile = await parseProfileWithAiFallback(text)
      if (aiProfile) {
        profile = {
          name: aiProfile.name || profile.name || user.name || "",
          title: aiProfile.title || profile.title || "",
          email: aiProfile.email || profile.email || user.email || "",
          phone: aiProfile.phone || profile.phone || "",
          location: aiProfile.location || profile.location || "",
          summary: aiProfile.summary || profile.summary || "",
          skills: aiProfile.skills?.length > 0 ? aiProfile.skills : profile.skills,
          experience: aiProfile.experience?.length > 0 ? aiProfile.experience : profile.experience,
          education: aiProfile.education?.length > 0 ? aiProfile.education : profile.education,
          projects: aiProfile.projects?.length > 0 ? aiProfile.projects : profile.projects,
        }
      }
    }

    // Preserve the user's verified sign-up name and login email as primary identity
    if (user.name) profile.name = user.name
    if (user.email) profile.email = user.email

    // Persist parsed profile against the authenticated user in PostgreSQL
    const saved = await saveParsedResume(user.id, fileName, profile)
    return NextResponse.json({ ok: true, ...saved }, { status: 200 })
  } catch (err) {
    console.error("[resume] Resume route error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ ok: false, reason: "error" }, { status: 200 })
  }
}
