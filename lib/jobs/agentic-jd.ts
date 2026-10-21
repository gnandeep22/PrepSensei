import "server-only"
import { generateObject } from "ai"
import { z } from "zod"
import { getChatModel } from "@/lib/ai/model"

export type GeneratedJobDraft = {
  title: string
  company: string
  location: string
  type: "Full-time" | "Part-time" | "Contract" | "Internship"
  experience: string
  salary: string
  requiredSkills: string[]
  description: string
  interviewQuestions: {
    question: string
    type: "technical" | "behavioral"
    skill: string
    keyPoints: string[]
  }[]
}

const jobDraftSchema = z.object({
  title: z.string().describe("Clear, standard industry job title (e.g. 'Senior Full Stack Engineer')"),
  company: z.string().describe("Company or organization name"),
  location: z.string().describe("Location with work mode (e.g. 'Bangalore, India (Hybrid)' or 'Remote')"),
  type: z.enum(["Full-time", "Part-time", "Contract", "Internship"]).describe("Employment type"),
  experience: z.string().describe("Experience requirement (e.g. '3-5 years', 'Fresher', '5+ years')"),
  salary: z.string().describe("Salary or CTC range (e.g. '₹18L - ₹26L / yr' or '$120,000 - $150,000')"),
  requiredSkills: z.array(z.string()).describe("List of 4-8 core technical and domain skills"),
  description: z.string().describe("Comprehensive markdown Job Description with Role Overview, Responsibilities, and Qualifications"),
  interviewQuestions: z.array(
    z.object({
      question: z.string().describe("Specific interview question tailored to this role"),
      type: z.enum(["technical", "behavioral"]).describe("Question category"),
      skill: z.string().describe("The primary skill or competency tested"),
      keyPoints: z.array(z.string()).describe("Expected points in a strong candidate response"),
    })
  ).describe("4 to 5 tailored interview questions for candidate screening"),
})

const SYSTEM_PROMPT = `You are an elite talent acquisition and technical recruiting AI agent.
Your task is to take a recruiter's natural language requirements or prompt and generate a complete, professional, industry-standard Job Description and tailored screening interview questions.

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
4. Generate 4-5 tailored screening interview questions (both technical deep-dives and situational/behavioral) that an AI interviewer can ask candidates applying for this specific position.
`

export async function generateJobFromPrompt(prompt: string, recruiterCompany?: string): Promise<GeneratedJobDraft> {
  const userPrompt = `Recruiter Prompt:\n"""${prompt}"""\n${recruiterCompany ? `Default Recruiter Company (use if not specified in prompt): ${recruiterCompany}` : ""}\n\nPlease generate the complete structured Job Description and tailored interview screening questions.`

  try {
    const { object } = await generateObject({
      model: getChatModel("gemini-3.8-flash"),
      system: SYSTEM_PROMPT,
      schema: jobDraftSchema,
      prompt: userPrompt,
      maxRetries: 1,
    })
    return object as GeneratedJobDraft
  } catch (err) {
    console.warn("[agentic-jd] Primary model (gemini-3.8-flash) failed, trying fallback model (gemini-3.1-flash-lite):", err)
    try {
      const { object } = await generateObject({
        model: getChatModel("gemini-3.1-flash-lite"),
        system: SYSTEM_PROMPT,
        schema: jobDraftSchema,
        prompt: userPrompt,
        maxRetries: 1,
      })
      return object as GeneratedJobDraft
    } catch (fallbackErr) {
      console.error("[agentic-jd] AI generation failed, using intelligent regex fallback parser:", fallbackErr)
      return generateFallbackJob(prompt, recruiterCompany)
    }
  }
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
  if (skills.length === 0) skills.push("System Design", "Problem Solving", "API Design", "Database Architecture")

  return {
    title,
    company: detectedCompany,
    location: lower.includes("remote") ? "Remote" : lower.includes("bangalore") ? "Bangalore, India" : lower.includes("hyderabad") ? "Hyderabad, India" : "Hybrid",
    type: "Full-time",
    experience: detectedExp,
    salary: detectedSalary,
    requiredSkills: skills,
    description: `## Role Overview\nWe are looking for a talented **${title}** to join ${detectedCompany}. In this role, you will architect high-performance solutions, collaborate with cross-functional partners, and build scalable systems.\n\n## Key Responsibilities\n- Design, develop, and maintain production-grade software applications.\n- Collaborate with product and design teams to deliver delightful user experiences.\n- Ensure high availability, code quality, and comprehensive automated test coverage.\n\n## Requirements\n- Experience (${detectedExp}) building scalable applications with ${skills.slice(0, 3).join(", ")}.\n- Strong problem-solving, communication, and ownership mindset.`,
    interviewQuestions: [
      {
        question: `Can you walk me through an end-to-end architecture you designed for a complex feature or system?`,
        type: "technical",
        skill: skills[0] || "Architecture",
        keyPoints: ["System scalability", "Component separation", "Performance trade-offs"],
      },
      {
        question: `How do you approach debugging and optimizing performance in a production environment?`,
        type: "technical",
        skill: "Performance Optimization",
        keyPoints: ["Profiling tools", "Database indexing", "Caching strategies"],
      },
      {
        question: `Tell me about a time you had a technical disagreement with a teammate. How did you resolve it constructively?`,
        type: "behavioral",
        skill: "Collaboration",
        keyPoints: ["Empathy", "Data-driven reasoning", "Alignment on team goals"],
      },
    ],
  }
}
