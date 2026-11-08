import "server-only"
import { generateObject } from "ai"
import { z } from "zod"
import { getChatModel } from "@/lib/ai/model"
import { raceGeminiGeneric } from "@/lib/ai/gemini-race"
import type { EvaluationCriterion } from "@/lib/demo-data"

export type { EvaluationCriterion }

export type GeneratedJobDraft = {
  title: string
  company: string
  location: string
  type: "Full-time" | "Part-time" | "Contract" | "Internship"
  experience: string
  salary: string
  requiredSkills: string[]
  description: string
  evaluationCriteria: EvaluationCriterion[]
  interviewQuestions?: {
    question: string
    type: "technical" | "behavioral"
    skill: string
    keyPoints: string[]
  }[]
  interviewDurationMinutes?: number
}

const evaluationCriterionSchema = z.object({
  id: z.string().describe("Unique identifier like 'criterion_1'"),
  title: z.string().describe("Clear, concise evaluation dimension title (e.g. 'RAG Architecture & Retrieval Systems')"),
  description: z.string().describe("Brief 1-2 sentence explanation of what will be evaluated"),
  keyAspects: z.array(z.string()).describe("3-5 core technical or problem-solving aspects to look for"),
  importance: z.enum(["high", "medium", "low"]).describe("Priority weight for this dimension: 'high', 'medium', or 'low'"),
})

const jobDraftSchema = z.object({
  title: z.string().describe("Clear, standard industry job title (e.g. 'Senior Full Stack Engineer')"),
  company: z.string().describe("Company or organization name"),
  location: z.string().describe("Location with work mode (e.g. 'Bangalore, India (Hybrid)' or 'Remote')"),
  type: z.enum(["Full-time", "Part-time", "Contract", "Internship"]).describe("Employment type"),
  experience: z.string().describe("Experience requirement (e.g. '3-5 years', 'Fresher', '5+ years')"),
  salary: z.string().describe("Salary or CTC range (e.g. '₹18L - ₹26L / yr' or '$120,000 - $150,000')"),
  requiredSkills: z.array(z.string()).describe("List of 4-8 core technical and domain skills"),
  description: z.string().describe("Comprehensive markdown Job Description with Role Overview, Responsibilities, and Qualifications"),
  evaluationCriteria: z.array(evaluationCriterionSchema).describe("5 to 8 structured evaluation criteria (evaluation dimensions, NOT interview questions) to assess candidates"),
})

const SYSTEM_PROMPT = `You are an elite talent acquisition and technical recruiting AI agent.
Your task is to take a recruiter's natural language requirements or prompt and generate a complete, professional, industry-standard Job Description and tailored screening evaluation criteria.

CRITICAL INSTRUCTIONS:
1. STRICT ADHERENCE TO USER'S CUSTOM VALUES:
   - If the user specifies or edits a company name anywhere in the prompt (e.g. "at Acme Corp", "Company: TechFlow", "Google", "MyStartup"), ALWAYS set company to that exact company name. Do NOT replace it with generic placeholders.
   - If the user specifies or edits experience (e.g. "2+ years", "Fresher", "7-10 yrs", "4+ yrs experience"), ALWAYS use that exact experience requirement.
   - If the user specifies location, salary/compensation, or work mode, ALWAYS preserve those exact values in the output.
2. Formulate 4-8 specific required skills matching the role.
3. Write a compelling, structured markdown description containing:
   - ## Role Overview
   - ## Key Responsibilities
   - ## Qualifications & Requirements
   - ## Nice to Have / Perks
4. Generate 5-8 structured evaluation criteria (evaluation dimensions, NOT interview questions):
   - These are assessment dimensions to evaluate candidates, NOT question sentences. Do NOT write sentences starting with 'Can you...', 'How do you...', etc.
   - Title: Crisp, authoritative title for the dimension (e.g. 'RAG Architecture & Retrieval Systems', 'LLM Agents & Tool Orchestration', 'Backend Engineering & API Performance', 'System Reliability & Incident Debugging').
   - Description: Concise 1-2 sentence explanation of what capabilities, architectural trade-offs, or competencies will be evaluated.
   - Key Aspects: 3-5 specific technical skills, concepts, or tools to look for.
   - Importance: Assign 'high' to critical core competencies, 'medium' to supporting requirements, and 'low' to optional/secondary areas.
   - Avoid repetitive or overlapping criteria. Prioritize important job-specific skills. Include both technical and relevant problem-solving competencies.
`

export async function generateJobFromPrompt(
  prompt: string,
  recruiterCompany?: string
): Promise<{
  draft: GeneratedJobDraft
  winningModel?: string
  winningModelLabel?: string
  raceDurationMs?: number
}> {
  const userPrompt = `Recruiter Prompt:\n"""${prompt}"""\n${recruiterCompany ? `Default Recruiter Company (use if not specified in prompt): ${recruiterCompany}` : ""}\n\nPlease generate the complete structured Job Description and tailored evaluation criteria adhering to schema: { title, company, location, type, experience, salary, requiredSkills, description, evaluationCriteria: [{ id, title, description, keyAspects, importance }] }.`

  const normalizeDraft = (rawDraft: any): GeneratedJobDraft => {
    const draft = { ...rawDraft }
    // Ensure criteria exists and has valid structure
    if (!Array.isArray(draft.evaluationCriteria) || draft.evaluationCriteria.length === 0) {
      draft.evaluationCriteria = generateFallbackCriteria(draft.requiredSkills || [], draft.title || "Software Engineer")
    }

    draft.evaluationCriteria = draft.evaluationCriteria.map((c: any, idx: number) => ({
      id: c.id || `criterion_${idx + 1}`,
      title: (c.title || `Evaluation Dimension ${idx + 1}`).trim(),
      description: (c.description || "Evaluate candidate competency and practical experience in this area.").trim(),
      keyAspects: Array.isArray(c.keyAspects) && c.keyAspects.length > 0 ? c.keyAspects : [c.title || "Core Skills"],
      importance: (c.importance === "high" || c.importance === "medium" || c.importance === "low") ? c.importance : "medium",
    }))

    // Synthesize legacy interviewQuestions for backward-compatibility with older consumers
    if (!Array.isArray(draft.interviewQuestions) || draft.interviewQuestions.length === 0) {
      draft.interviewQuestions = draft.evaluationCriteria.slice(0, 5).map((c: EvaluationCriterion) => ({
        question: `Can you walk me through your hands-on experience with ${c.title}, specifically addressing ${c.keyAspects.slice(0, 2).join(" and ")}?`,
        type: "technical" as const,
        skill: c.keyAspects[0] || c.title,
        keyPoints: c.keyAspects,
      }))
    }

    return draft
  }

  try {
    // 1. Parallel Multi-Model Gemini Race: fastest valid model wins!
    const raceResult = await raceGeminiGeneric<GeneratedJobDraft>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      validate: (parsed) => Boolean(
        parsed &&
        parsed.title &&
        parsed.description &&
        Array.isArray(parsed.requiredSkills) &&
        (Array.isArray(parsed.evaluationCriteria) || Array.isArray((parsed as any).interviewQuestions))
      ),
      timeoutMs: 25000,
      temperature: 0.2,
    })

    return {
      draft: normalizeDraft(raceResult.data),
      winningModel: raceResult.winningModel,
      winningModelLabel: raceResult.winningModelLabel,
      raceDurationMs: raceResult.raceDurationMs,
    }
  } catch (raceErr) {
    console.warn("[agentic-jd] AI race failed or all models in cooldown, trying single model fallback:", raceErr)
    try {
      const { object } = await generateObject({
        model: getChatModel("gemini-3.5-flash-lite"),
        system: SYSTEM_PROMPT,
        schema: jobDraftSchema,
        prompt: userPrompt,
        maxRetries: 1,
      })
      return {
        draft: normalizeDraft(object),
        winningModel: "gemini-3.5-flash-lite",
        winningModelLabel: "Gemini 3.5 Flash-Lite"
      }
    } catch (fallbackErr) {
      console.error("[agentic-jd] AI generation failed, using intelligent regex fallback parser:", fallbackErr)
      return { draft: generateFallbackJob(prompt, recruiterCompany) }
    }
  }
}

/** Generate 5-7 evaluation dimensions based on role and skills */
function generateFallbackCriteria(skills: string[], roleTitle: string): EvaluationCriterion[] {
  const criteria: EvaluationCriterion[] = []
  const primarySkill = skills[0] || "Software Architecture"
  const secondarySkill = skills[1] || "System Design"
  const tertiarySkill = skills[2] || "Backend Engineering"

  criteria.push({
    id: "criterion_1",
    title: `${primarySkill} Architecture & Core Design`,
    description: `Evaluate the candidate's depth in ${primarySkill}, including system structure, component design, and best practices.`,
    keyAspects: [primarySkill, "Design patterns", "Modularity", "Scalability"],
    importance: "high",
  })

  criteria.push({
    id: "criterion_2",
    title: `${secondarySkill} & Technical Problem Solving`,
    description: `Assess hands-on proficiency with ${secondarySkill}, state management, and resolving complex edge cases.`,
    keyAspects: [secondarySkill, "Algorithm design", "State management", "Error resilience"],
    importance: "high",
  })

  if (skills.length > 2) {
    criteria.push({
      id: "criterion_3",
      title: `${tertiarySkill} Integration & Data Flow`,
      description: `Evaluate practical experience integrating ${tertiarySkill} with external services and high-volume data streams.`,
      keyAspects: [tertiarySkill, "API integration", "Data serialization", "Latency optimization"],
      importance: "medium",
    })
  }

  criteria.push({
    id: "criterion_4",
    title: "Performance Optimization & Concurrency",
    description: "Assess ability to profile code, reduce compute bottlenecks, and design concurrent asynchronous workflows.",
    keyAspects: ["Profiling", "Caching strategies", "Concurrency", "Database indexing"],
    importance: "high",
  })

  criteria.push({
    id: "criterion_5",
    title: "Production Reliability & Incident Debugging",
    description: "Evaluate experience with diagnosing production failures, monitoring system health, and post-mortem analysis.",
    keyAspects: ["Root cause analysis", "Observability", "Logging & telemetry", "Failure recovery"],
    importance: "high",
  })

  criteria.push({
    id: "criterion_6",
    title: "Engineering Collaboration & Technical Communication",
    description: "Assess ability to articulate technical trade-offs, conduct constructive code reviews, and drive engineering alignment.",
    keyAspects: ["Code reviews", "Technical trade-offs", "Cross-team communication", "Mentorship"],
    importance: "medium",
  })

  return criteria
}

/** Fallback parser if Gemini API is unreachable */
function generateFallbackJob(prompt: string, defaultCompany = "Tech Innovations"): GeneratedJobDraft {
  const lower = prompt.toLowerCase()
  let title = "Software Engineer"
  if (lower.includes("frontend") || lower.includes("react")) title = "Frontend Engineer"
  else if (lower.includes("backend") || lower.includes("python") || lower.includes("node")) title = "Backend Engineer"
  else if (lower.includes("full stack") || lower.includes("fullstack")) title = "Full Stack Engineer"
  else if (lower.includes("devops") || lower.includes("cloud")) title = "DevOps / Cloud Engineer"
  else if (lower.includes("product manager")) title = "Product Manager"
  else if (lower.includes("data") || lower.includes("ai") || lower.includes("ml")) title = "Data Scientist / AI Engineer"
  else if (lower.includes("rust")) title = "Rust Systems Engineer"

  // Intelligent extraction of user-customized values from prompt
  const companyMatch = prompt.match(/(?:at\s+|company[:\s]+|for\s+)([A-Za-z0-9\s&.]+?)(?:\s+(?:in|hiring|seeking|with|requiring)|[,\n]|$)/i)
  const expMatch = prompt.match(/(\d+\+?\s*(?:-\s*\d+)?\s*(?:years?|yrs?)(?:\s+experience)?|fresher|entry[- ]level)/i)
  const salMatch = prompt.match(/([₹$€£]\s*[\d.]+\s*(?:-\s*[\d.]+)?\s*(?:LPA|k|M|L|lakhs?|year|yr|\/yr)?)/i)

  const detectedCompany = companyMatch ? companyMatch[1].trim() : defaultCompany || "Hiring Partner"
  const detectedExp = expMatch ? expMatch[0].trim() : "3+ years"
  const detectedSalary = salMatch ? salMatch[0].trim() : "₹18L - ₹28L / yr"

  const skills: string[] = []
  if (lower.includes("react")) skills.push("React.js")
  if (lower.includes("next")) skills.push("Next.js")
  if (lower.includes("node")) skills.push("Node.js")
  if (lower.includes("python")) skills.push("Python")
  if (lower.includes("rust")) skills.push("Rust")
  if (lower.includes("typescript") || lower.includes("ts")) skills.push("TypeScript")
  if (lower.includes("postgres") || lower.includes("sql")) skills.push("PostgreSQL")
  if (lower.includes("aws")) skills.push("AWS")
  if (lower.includes("docker")) skills.push("Docker")
  if (lower.includes("kubernetes") || lower.includes("k8s")) skills.push("Kubernetes")
  if (lower.includes("rag") || lower.includes("retrieval")) skills.push("RAG Architecture")
  if (lower.includes("llm") || lower.includes("agent")) skills.push("LLM Agents")
  if (lower.includes("fastapi")) skills.push("FastAPI")
  if (skills.length === 0) skills.push("System Design", "Problem Solving", "API Design", "Database Architecture")

  const evaluationCriteria = generateFallbackCriteria(skills, title)

  return {
    title,
    company: detectedCompany,
    location: lower.includes("remote") ? "Remote" : lower.includes("bangalore") ? "Bangalore, India" : lower.includes("hyderabad") ? "Hyderabad, India" : "Hybrid",
    type: "Full-time",
    experience: detectedExp,
    salary: detectedSalary,
    requiredSkills: skills,
    description: `## Role Overview\nWe are looking for a talented **${title}** to join ${detectedCompany}. In this role, you will architect high-performance solutions, collaborate with cross-functional partners, and build scalable systems.\n\n## Key Responsibilities\n- Design, develop, and maintain production-grade software applications.\n- Collaborate with product and design teams to deliver delightful user experiences.\n- Ensure high availability, code quality, and comprehensive automated test coverage.\n\n## Requirements\n- Experience (${detectedExp}) building scalable applications with ${skills.slice(0, 3).join(", ")}.\n- Strong problem-solving, communication, and ownership mindset.`,
    evaluationCriteria,
    interviewQuestions: evaluationCriteria.slice(0, 4).map((c) => ({
      question: `Can you walk me through your practical experience with ${c.title}, focusing on ${c.keyAspects.slice(0, 2).join(" and ")}?`,
      type: "technical",
      skill: c.keyAspects[0] || c.title,
      keyPoints: c.keyAspects,
    })),
  }
}

