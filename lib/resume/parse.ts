// Lightweight, deterministic resume parser (no LLM).
// Extracts structured candidate fields from plain resume text using section
// headings and heuristics. It never invents data: any field it cannot find is
// returned empty so downstream agents only see real resume evidence.

import { extractSkills } from "@/lib/skills"
import type { CandidateProfile, Education, Experience, Project } from "@/lib/demo-data"

const SECTION_SYNONYMS: Record<string, string[]> = {
  summary: ["summary", "professional summary", "profile", "objective", "about", "about me", "career objective"],
  skills: ["skills", "technical skills", "core skills", "technologies", "tech stack", "key skills"],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment",
    "employment history",
    "work history",
  ],
  education: ["education", "academic background", "academics", "qualifications"],
  projects: ["projects", "personal projects", "selected projects", "notable projects", "side projects"],
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/
const YEARS_RE =
  /((?:19|20)\d{2})(?:\s*(?:[–—-]|to|until)\s*((?:19|20)\d{2}|present|current|now))?|present|current/i
const TITLE_KW =
  /(developer|engineer|designer|manager|analyst|scientist|architect|consultant|intern|programmer|administrator|specialist|lead|director|devops|full[- ]?stack|front[- ]?end|back[- ]?end)/i
const DEGREE_RE =
  /(ph\.?d|doctorate|master|m\.?sc|m\.?eng|m\.?tech|mba|bachelor|b\.?sc|b\.?eng|b\.?tech|b\.?a\b|associate|diploma|certificate|higher national)/i
const INSTITUTION_RE = /(university|college|institute|school|academy|polytechnic)/i
const BULLET_RE = /^[-•*·▪◦‣]\s?/

function normalizeHeading(line: string) {
  return line.trim().toLowerCase().replace(/[:.\s]+$/, "").trim()
}

function matchSection(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 40) return null
  const norm = normalizeHeading(trimmed)
  for (const [key, synonyms] of Object.entries(SECTION_SYNONYMS)) {
    if (synonyms.includes(norm)) return key
  }
  return null
}

function extractYears(line: string): string {
  const m = line.match(YEARS_RE)
  if (!m) return ""
  return m[0].replace(/\s+/g, " ").trim()
}

function stripYears(line: string): string {
  return line.replace(YEARS_RE, "").replace(/\s{2,}/g, " ").replace(/[,\-–—|]\s*$/, "").trim()
}

function looksLikeName(line: string) {
  const t = line.trim()
  if (!t || t.length > 40) return false
  if (/[@\d|•]/.test(t)) return false
  const words = t.split(/\s+/)
  if (words.length < 2 || words.length > 4) return false
  return words.every((w) => /^[A-Z][a-zA-Z.'-]*$/.test(w))
}

function firstMatch(text: string, re: RegExp): string {
  const m = text.match(re)
  return m ? m[0].trim() : ""
}

function splitEntry(rest: string): { title: string; company: string } {
  const sep = rest.split(/\s+(?:at|@|—|–|-|\|)\s+/i)
  if (sep.length >= 2) return { title: sep[0].trim(), company: sep.slice(1).join(" ").trim() }
  if (rest.includes(",")) {
    const parts = rest.split(",")
    return { title: parts[0].trim(), company: parts.slice(1).join(",").trim() }
  }
  return { title: rest.trim(), company: "" }
}

function parseExperience(lines: string[]): Experience[] {
  const entries: Experience[] = []
  let current: Experience | null = null
  for (const raw of lines) {
    const t = raw.trim()
    if (!t) continue
    if (BULLET_RE.test(t)) {
      if (current) current.highlights.push(t.replace(BULLET_RE, "").trim())
      continue
    }
    const years = extractYears(t)
    const rest = stripYears(t)
    if (!rest && !years) continue
    if (current) entries.push(current)
    const { title, company } = splitEntry(rest)
    current = { title: title || company, company: title ? company : "", years, highlights: [] }
  }
  if (current) entries.push(current)
  return entries.filter((e) => e.title).slice(0, 8)
}

function parseEducation(lines: string[]): Education[] {
  const entries: Education[] = []
  for (const raw of lines) {
    const t = raw.trim().replace(BULLET_RE, "")
    if (!t) continue
    const years = extractYears(t)
    const noYears = stripYears(t)
    if (DEGREE_RE.test(t)) {
      let degree = noYears
      let institution = ""
      if (noYears.includes(",")) {
        const parts = noYears.split(",")
        degree = parts[0].trim()
        institution = parts.slice(1).join(",").trim()
      }
      entries.push({ degree: degree.trim(), institution, years })
    } else if (INSTITUTION_RE.test(t)) {
      const last = entries[entries.length - 1]
      if (last && !last.institution) {
        last.institution = noYears
        if (!last.years && years) last.years = years
      } else {
        entries.push({ degree: "", institution: noYears, years })
      }
    }
  }
  return entries.filter((e) => e.degree || e.institution).slice(0, 6)
}

function parseProjects(lines: string[]): Project[] {
  type Draft = { name: string; parts: string[] }
  const drafts: Draft[] = []
  let current: Draft | null = null
  for (const raw of lines) {
    const t = raw.trim()
    if (!t) continue
    if (BULLET_RE.test(t)) {
      if (current) current.parts.push(t.replace(BULLET_RE, "").trim())
      continue
    }
    if (current) drafts.push(current)
    let name = t
    let desc = ""
    const splitPoint = t.split(/\s*[—–\-|:]\s*/)
    if (splitPoint.length >= 2) {
      name = splitPoint[0].trim()
      desc = splitPoint.slice(1).join(" ").trim()
    }
    current = { name, parts: desc ? [desc] : [] }
  }
  if (current) drafts.push(current)
  return drafts
    .filter((d) => d.name)
    .slice(0, 8)
    .map((d) => {
      const blob = [d.name, ...d.parts].join(" ")
      const description = d.parts.join(" ").slice(0, 200)
      return { name: d.name.slice(0, 80), description, tech: extractSkills(blob).slice(0, 8) }
    })
}

/** Parse raw resume text into a CandidateProfile, leaving unknown fields empty. */
export function parseResumeText(text: string): CandidateProfile {
  const cleaned = text.replace(/\r/g, "").replace(/\u00a0/g, " ")
  const lines = cleaned.split("\n").map((l) => l.replace(/\t/g, " ").replace(/ {2,}/g, " ").trimEnd())

  const sections: Record<string, string[]> = { header: [] }
  let currentKey = "header"
  for (const line of lines) {
    const section = matchSection(line)
    if (section) {
      currentKey = section
      if (!sections[currentKey]) sections[currentKey] = []
      continue
    }
    ;(sections[currentKey] ||= []).push(line)
  }

  const header = sections.header ?? []
  const headerNonEmpty = header.filter((l) => l.trim())

  const email = firstMatch(cleaned, EMAIL_RE)
  const phoneRaw = firstMatch(cleaned, PHONE_RE)
  const phone = phoneRaw && phoneRaw.replace(/\D/g, "").length >= 8 ? phoneRaw : ""

  const name = headerNonEmpty.find(looksLikeName)?.trim() ?? ""
  const title =
    headerNonEmpty
      .find((l) => l.trim() !== name && TITLE_KW.test(l) && l.trim().length <= 60)
      ?.split("|")[0]
      .trim() ?? ""
  const location =
    headerNonEmpty
      .find(
        (l) =>
          l.trim() !== name &&
          l.trim().length <= 40 &&
          /^[A-Za-z.\s]+,\s*[A-Za-z.\s]+$/.test(l.trim()) &&
          !TITLE_KW.test(l),
      )
      ?.trim() ?? ""

  const summary = (sections.summary ?? []).join(" ").replace(/\s{2,}/g, " ").trim().slice(0, 600)

  return {
    name,
    title,
    email,
    phone,
    location,
    summary,
    skills: extractSkills(cleaned).slice(0, 30),
    education: parseEducation(sections.education ?? []),
    experience: parseExperience(sections.experience ?? []),
    projects: parseProjects(sections.projects ?? []),
  }
}
