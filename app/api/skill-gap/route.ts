import { NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { getChatModel } from "@/lib/ai/model"
import { resolveReliableUrl } from "@/lib/study-plan/url-resolver"
import { getSessionUser } from "@/lib/session"

export const runtime = "nodejs"

// ---------------------------------------------------------------------------
// RAG SKILL GAP ANALYSIS SCHEMA
// ---------------------------------------------------------------------------
export const skillGapAnalysisSchema = z.object({
  overallMatchScore: z.number().min(0).max(100).describe("Overall semantic match score (0-100) between resume and job description"),
  matchSummary: z.string().describe("Executive assessment explaining candidate alignment, strong competencies, and primary gaps relative to the job requirements"),
  roleFitTier: z.enum([
    "Strong Match",
    "Competitive Match",
    "Stretch Opportunity",
    "Significant Upskilling Needed",
  ]).describe("Categorical fit tier for this candidate and role"),
  strongSkills: z.array(
    z.object({
      skill: z.string().describe("Skill or technology with verified evidence in the candidate's resume"),
      level: z.number().min(50).max(100).describe("Demonstrated competency level (50-100)"),
      evidenceFromResume: z.string().describe("Direct quote, project accomplishment, or experience citation from the resume proving this skill"),
      relevanceToRole: z.string().describe("Why this strength directly satisfies an essential requirement of the target job"),
    })
  ).describe("Skills and competencies substantiated with proof in the candidate's resume"),
  gaps: z.array(
    z.object({
      skill: z.string().describe("Skill, framework, or capability required by the JD that is absent or weak in the resume"),
      priority: z.enum(["Critical", "High", "Medium", "Low"]).describe("Gap priority / hiring hurdle level"),
      level: z.number().min(5).max(50).describe("Current estimated competency level (5-50)"),
      whyNeededInJob: z.string().describe("Exact requirement or architectural responsibility from the JD necessitating this skill"),
      candidateCurrentStanding: z.string().describe("Candidate's current standing (e.g. 'No evidence in resume', 'Familiar with alternative tool X', 'Has academic project but lacks production scale')"),
      estimatedTimeToBridge: z.string().describe("Realistic preparation duration to bridge this gap, e.g. '3-5 days', '1-2 weeks'"),
      actionableAdvice: z.string().describe("Concrete recommendation on how to learn and demonstrate this skill before the interview"),
      resources: z.array(
        z.object({
          title: z.string().describe("Resource title"),
          url: z.string().describe("Authentic web URL"),
          type: z.string().describe("Platform type, e.g. 'Official Docs', 'YouTube', 'GeeksforGeeks', 'LeetCode', 'freeCodeCamp', 'GitHub'"),
          description: z.string().describe("Why this resource is essential for bridging this specific gap"),
        })
      ).describe("Handpicked learning resources to bridge this gap"),
    })
  ).describe("Prioritized skill gaps identified by comparing resume against JD"),
  adjacentSkills: z.array(
    z.object({
      candidateSkill: z.string().describe("Skill the candidate already possesses"),
      targetRequirement: z.string().describe("Job requirement that can be bridged from candidateSkill"),
      transferabilityPct: z.number().min(10).max(95).describe("Estimated transferability percentage"),
      notes: z.string().describe("How their existing background translates to learning the new requirement quickly"),
    })
  ).describe("Transferable skills that make bridging gaps faster"),
  interviewQuestionsOnGaps: z.array(
    z.object({
      question: z.string().describe("Technical interview question likely to be asked specifically probing this gap"),
      targetedGap: z.string().describe("The gap this question targets"),
      whatInterviewersLookFor: z.string().describe("What the interviewer evaluates in the candidate's response"),
      recommendedAnswerStrategy: z.string().describe("How to answer effectively and pivot positively even if the skill is newly acquired"),
    })
  ).describe("Anticipated interview questions targeting identified gaps"),
})

export type SkillGapAnalysisResult = z.infer<typeof skillGapAnalysisSchema>

const RAG_SYSTEM_PROMPT = `You are a Principal Technical Recruiter, Staff Engineering Hiring Manager, and Retrieval-Augmented Generation (RAG) Evaluator at a top technology firm.

Your mission is to perform a rigorous, evidence-grounded RAG gap analysis between a CANDIDATE'S VERIFIED RESUME and a TARGET JOB DESCRIPTION.

CRITICAL INSTRUCTIONS:
1. STRICT FACTUAL GROUNDING (NO HALLUCINATIONS, NO RANDOM/HARDCODED GUESSES):
   - Every "Strong Skill" MUST be substantiated by concrete evidence present in the candidate's resume (cite the project, accomplishment, or experience bullet).
   - Every "Skill Gap" MUST correspond to an actual requirement or expectation stated or strongly implied by the Job Description that is missing or insufficiently demonstrated in the candidate's resume.
   - Do NOT invent skills the candidate does not have as "Strong".
   - Do NOT invent requirements the employer does not ask for as "Gaps".

2. ACTIONABLE & PRIORITIZED GAP ANALYSIS:
   - Rank gaps by true hiring impact:
     * "Critical": Deal-breaker skills that form the primary day-to-day work of this role.
     * "High": Core secondary competencies expected in technical rounds.
     * "Medium": Standard architectural or workflow tools (e.g. CI/CD, Redis, Docker).
     * "Low": Nice-to-have or easily learned on the job.
   - Provide realistic estimates for bridging each gap (e.g., "3-5 days", "1-2 weeks").
   - Identify "Adjacent Skills" where the candidate's existing background transfers (e.g. React -> Next.js, PostgreSQL -> MySQL, AWS -> GCP).

3. 100% WORKING, RELIABLE WEB & VIDEO RESOURCES:
   - For every gap, provide 3-4 premier learning resources across the internet:
     * Official Documentation / DevDocs
     * Search-based YouTube Video tutorials ("https://www.youtube.com/results?search_query=<topic>+tutorial")
     * GeeksforGeeks topic search ("https://www.geeksforgeeks.org/search/?q=<topic>")
     * freeCodeCamp or LeetCode search links
     * Architecture / GitHub references
   - Never invent broken video IDs (watch?v=xyz) or fake deep article slugs.

4. ANTICIPATED INTERVIEW QUESTIONS:
   - Provide realistic, probing technical interview questions that interviewers will ask to test whether the candidate has bridged these gaps.
   - Give strategic advice on how to respond honestly while showcasing fast learning ability.
`

function sanitizeAnalysisUrls(result: SkillGapAnalysisResult): SkillGapAnalysisResult {
  if (!result?.gaps || !Array.isArray(result.gaps)) return result
  for (const gap of result.gaps) {
    if (Array.isArray(gap.resources)) {
      for (const res of gap.resources) {
        res.url = resolveReliableUrl(res.url, res.title, gap.skill)
      }
    }
  }
  return result
}

/**
 * Intelligent deterministic RAG fallback if LLM APIs are unreachable.
 * Dynamically parses and compares candidate profile against job description.
 */
function generateDeterministicRagAnalysis(job: any, profile: any): SkillGapAnalysisResult {
  const jobTitle = job?.title || "Software Engineer"
  const company = job?.company || "Target Company"
  const requiredSkills: string[] = job?.requiredSkills || []
  const candidateSkills: string[] = profile?.skills || []
  const experienceList: any[] = profile?.experience || []
  const projectsList: any[] = profile?.projects || []

  // Check which required skills are matched in candidate skills or projects/experience
  const strong: any[] = []
  const gaps: any[] = []

  const candidateTextCorpus = [
    ...candidateSkills,
    profile?.summary || "",
    ...experienceList.map((e) => `${e.title} ${e.company} ${e.highlights?.join(" ")}`),
    ...projectsList.map((p) => `${p.name} ${p.description} ${p.tech?.join(" ")}`),
  ].join(" ").toLowerCase()

  for (const req of requiredSkills) {
    const reqLower = req.toLowerCase()
    const isDirectMatch = candidateSkills.some((s) => s.toLowerCase() === reqLower || reqLower.includes(s.toLowerCase()) || s.toLowerCase().includes(reqLower))
    const isMentionedInCorpus = candidateTextCorpus.includes(reqLower)

    if (isDirectMatch || isMentionedInCorpus) {
      let evidence = `Documented in candidate skills: "${req}".`
      const matchingProj = projectsList.find((p) => p.name?.toLowerCase().includes(reqLower) || p.description?.toLowerCase().includes(reqLower) || p.tech?.some((t: string) => t.toLowerCase().includes(reqLower)))
      if (matchingProj) {
        evidence = `Demonstrated in project "${matchingProj.name}": ${matchingProj.description?.slice(0, 100)}...`
      } else {
        const matchingExp = experienceList.find((e) => e.highlights?.some((h: string) => h.toLowerCase().includes(reqLower)))
        if (matchingExp) {
          evidence = `Applied at ${matchingExp.company} (${matchingExp.title}) in production deliverables.`
        }
      }

      strong.push({
        skill: req,
        level: 80,
        evidenceFromResume: evidence,
        relevanceToRole: `Core requirement for ${jobTitle} at ${company}.`,
      })
    } else {
      gaps.push({
        skill: req,
        priority: gaps.length === 0 ? "Critical" : gaps.length <= 2 ? "High" : "Medium",
        level: 25,
        whyNeededInJob: `Required by ${company} for ${jobTitle} core deliverables.`,
        candidateCurrentStanding: `Not found in candidate resume or portfolio.`,
        estimatedTimeToBridge: "1-2 weeks",
        actionableAdvice: `Review official documentation, build a hands-on project, and study common interview patterns for ${req}.`,
        resources: [
          {
            title: `${req} Official Documentation & Specs`,
            url: `https://devdocs.io/#q=${encodeURIComponent(req)}`,
            type: "Official Docs",
            description: `Authoritative reference and API documentation for ${req}.`,
          },
          {
            title: `${req} Full Course & Crash Course (YouTube)`,
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(req + " full tutorial course interview")}`,
            type: "YouTube",
            description: `Visual deep dive and walkthrough of core concepts in ${req}.`,
          },
          {
            title: `${req} Interview Walkthroughs (GeeksforGeeks)`,
            url: `https://www.geeksforgeeks.org/search/?q=${encodeURIComponent(req)}`,
            type: "GeeksforGeeks",
            description: `Frequently asked interview questions and conceptual breakdowns for ${req}.`,
          },
          {
            title: `${req} Coding Practice (LeetCode)`,
            url: `https://leetcode.com/problemset/all/?search=${encodeURIComponent(req)}`,
            type: "LeetCode",
            description: `Practical implementation challenges and algorithmic patterns.`,
          },
        ],
      })
    }
  }

  const matchScore = requiredSkills.length > 0 ? Math.round((strong.length / requiredSkills.length) * 100) : 75
  const fitTier = matchScore >= 80 ? "Strong Match" : matchScore >= 60 ? "Competitive Match" : matchScore >= 40 ? "Stretch Opportunity" : "Significant Upskilling Needed"

  return {
    overallMatchScore: matchScore,
    matchSummary: `RAG analysis determined a ${matchScore}% alignment between candidate resume and ${company}'s ${jobTitle} requirements. Candidate possesses verified strength in ${strong.slice(0, 3).map((s) => s.skill).join(", ") || "core fundamentals"}, with primary gaps in ${gaps.slice(0, 3).map((g) => g.skill).join(", ") || "none"}.`,
    roleFitTier: fitTier,
    strongSkills: strong,
    gaps,
    adjacentSkills: [
      {
        candidateSkill: candidateSkills[0] || "Programming Fundamentals",
        targetRequirement: gaps[0]?.skill || "System Architecture",
        transferabilityPct: 65,
        notes: "Foundational software engineering principles directly apply to mastering this requirement.",
      },
    ],
    interviewQuestionsOnGaps: gaps.slice(0, 3).map((g) => ({
      question: `How would you approach designing a production feature using ${g.skill}, and what performance trade-offs would you anticipate?`,
      targetedGap: g.skill,
      whatInterviewersLookFor: `Ability to articulate architectural trade-offs, standard patterns, and debugging strategies for ${g.skill}.`,
      recommendedAnswerStrategy: `Acknowledge your current depth, connect your related experience in parallel technologies, and explain how you apply core principles to ${g.skill}.`,
    })),
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    const body = await req.json()
    const { job, profile, resumeText } = body

    if (!job || !profile) {
      return NextResponse.json({ error: "Missing job or profile payload" }, { status: 400 })
    }

    const jobTitle = job.title || "Software Engineer"
    const company = job.company || "Target Company"
    const jobDescription = job.description || ""
    const requiredSkills = job.requiredSkills || []

    // 1. Build Ground Truth RAG Documents
    const resumeDocument = `=== CANDIDATE RESUME EVIDENCE ===
Candidate Name: ${profile.name || "Candidate"}
Professional Title: ${profile.title || "Software Developer"}
Summary: ${profile.summary || "Not provided"}
Documented Skills: ${Array.isArray(profile.skills) ? profile.skills.join(", ") : "None"}

Education:
${Array.isArray(profile.education) && profile.education.length > 0 ? profile.education.map((e: any) => `- ${e.degree} at ${e.institution} (${e.years})`).join("\n") : "None listed"}

Work Experience:
${Array.isArray(profile.experience) && profile.experience.length > 0 ? profile.experience.map((x: any) => `- Role: ${x.title} at ${x.company} (${x.years})\n  Key Highlights:\n${Array.isArray(x.highlights) ? x.highlights.map((h: string) => `    * ${h}`).join("\n") : "    * None"}`).join("\n\n") : "None listed"}

Key Projects:
${Array.isArray(profile.projects) && profile.projects.length > 0 ? profile.projects.map((p: any) => `- Project: ${p.name}\n  Tech Stack: ${Array.isArray(p.tech) ? p.tech.join(", ") : "None"}\n  Description: ${p.description}`).join("\n\n") : "None listed"}

${resumeText ? `\nExtracted Resume Raw Text Snippet:\n${resumeText.slice(0, 1500)}` : ""}
`

    const jobDocument = `=== TARGET JOB SPECIFICATION ===
Job Title: ${jobTitle}
Company: ${company}
Location: ${job.location || "Remote"}
Job Type: ${job.type || "Full-time"}
Experience Level: ${job.experience || "Not specified"}
Required Skills: ${Array.isArray(requiredSkills) ? requiredSkills.join(", ") : "None"}

Job Description & Responsibilities:
${jobDescription || "Standard software engineering duties matching role requirements."}
`

    const prompt = `${resumeDocument}

${jobDocument}

Conduct a comprehensive RAG-grounded skill gap analysis comparing the candidate's verified resume evidence against this target job description. Identify genuine strong skills with citations, prioritized skill gaps with root causes, adjacent transferable skills, and anticipated interview questions.`

    try {
      const { object } = await generateObject({
        model: getChatModel("gemini-3.8-flash"),
        system: RAG_SYSTEM_PROMPT,
        schema: skillGapAnalysisSchema,
        prompt,
        maxRetries: 1,
      })

      const sanitized = sanitizeAnalysisUrls(object)
      return NextResponse.json({ success: true, analysis: sanitized, source: "gemini-3.8-flash" })
    } catch (primaryErr) {
      console.warn("[skill-gap] Primary model gemini-3.8-flash failed, falling back to gemini-3.1-flash-lite:", primaryErr)
      try {
        const { object } = await generateObject({
          model: getChatModel("gemini-3.1-flash-lite"),
          system: RAG_SYSTEM_PROMPT,
          schema: skillGapAnalysisSchema,
          prompt,
          maxRetries: 1,
        })
        const sanitized = sanitizeAnalysisUrls(object)
        return NextResponse.json({ success: true, analysis: sanitized, source: "gemini-3.1-flash-lite" })
      } catch (fallbackErr) {
        console.warn("[skill-gap] Fallback model failed, using deterministic RAG matcher:", fallbackErr)
        const deterministic = generateDeterministicRagAnalysis(job, profile)
        return NextResponse.json({ success: true, analysis: deterministic, source: "deterministic-rag" })
      }
    }
  } catch (err: any) {
    console.error("[POST /api/skill-gap Error]:", err)
    return NextResponse.json({ error: err.message || "Failed to generate skill gap analysis" }, { status: 500 })
  }
}
