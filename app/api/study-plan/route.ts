import { NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { getChatModel } from "@/lib/ai/model"
import { resolveReliableUrl } from "@/lib/study-plan/url-resolver"

export const studyPlanSchema = z.object({
  title: z.string().describe("Descriptive title for the customized study roadmap"),
  targetRole: z.string().describe("Target job title"),
  company: z.string().describe("Target company name"),
  summary: z.string().describe("Strategic overview explaining how this curriculum addresses the candidate's specific gaps and prepares them to pass the interview"),
  estimatedHoursPerWeek: z.number().describe("Recommended study hours per week, e.g. 8-12"),
  weeks: z.array(
    z.object({
      week: z.number().describe("Week number (1 to 4)"),
      topic: z.string().describe("Concise high-impact theme for this week"),
      focusSkills: z.array(z.string()).describe("2-4 core competencies prioritized this week"),
      whyItMatters: z.string().describe("Direct explanation of why this matters for the target job, exam, or interview"),
      whatToLearn: z.array(z.string()).describe("3-5 key concepts, topics, or competencies to master this week"),
      practice: z.string().describe("Real-world hands-on activity, practice exercise, or scenario relevant to the role"),
      resources: z.array(
        z.object({
          title: z.string().describe("Resource title (e.g. 'SSC CGL Previous Papers', 'PostgreSQL Official Docs', 'Reasoning Shortcuts Course')"),
          url: z.string().describe("Authentic web URL (official sites, coaching platforms, YouTube search, documentation, etc.)"),
          type: z.string().describe("Platform/type (e.g. 'Official Docs', 'Coaching Platform', 'YouTube', 'Previous Papers', 'freeCodeCamp', 'LeetCode', 'GeeksforGeeks', 'GitHub')"),
          description: z.string().describe("Why this resource is essential and what specific topics or sections to focus on"),
        })
      ).describe("3-5 vetted premier learning resources"),
      interviewQuestions: z.array(z.string()).describe("2-3 actual interview or exam questions typically asked for this topic"),
    })
  ).describe("Structured 4-week preparation plan"),
})

export type GeneratedStudyPlan = z.infer<typeof studyPlanSchema>

const STUDY_PLAN_SYSTEM_PROMPT = `You are an Expert Career Mentor and Interview Coach. You create deeply personalized 4-week study plans for candidates preparing for ANY type of job — whether it is software engineering, government services, police, banking, civil services, teaching, healthcare, management, or any other profession.

Your task is to create a targeted, high-yield 4-week study plan based on the specific job role, required skills, and the candidate's existing competencies.

CRITICAL GUIDELINES:
1. TARGETED TO THE ACTUAL ROLE & ORGANIZATION:
   - Tailor the curriculum ENTIRELY to the target role and its actual requirements. Do NOT assume it is a software engineering role.
   - If the role is a government exam (e.g. SSC, UPSC, Banking), include syllabus topics like General Knowledge, Reasoning, Quantitative Aptitude, English, Physical Standards, etc.
   - If the role is a tech role, include relevant technical skills, coding practice, system design, etc.
   - Address the candidate's actual skill gaps and any interview feedback provided.

2. DIVERSE, PREMIER WEB RESOURCES:
   Provide a diverse mix of the best learning material relevant to the target role:
   - For government/competitive exams: exam-specific portals (ssc.nic.in, upsc.gov.in), coaching platforms (Unacademy, BYJU's Exam Prep, Testbook, Oliveboard), previous year papers, current affairs sources (The Hindu, PIB).
   - For tech roles: Official documentation, engineering blogs, LeetCode, freeCodeCamp, YouTube tutorials, GeeksforGeeks.
   - For other professions: professional certification sites, industry-specific learning platforms, official regulatory body resources.

3. 100% WORKING, RELIABLE URL RULES (ZERO 404s, ZERO BROKEN LINKS):
   - Never invent arbitrary URLs or deep links. Use search queries or verified domain roots.
   - For YouTube, use search queries: "https://www.youtube.com/results?search_query=<topic>+tutorial".
   - For general searches, use verified search URLs for the respective platforms.
   - For official government sites, link to verified domain roots (e.g., "https://ssc.nic.in/", "https://upsc.gov.in/").

4. CONCRETE & ACTIONABLE:
   - Give precise, hands-on practice activities relevant to the role (e.g., "Solve 50 previous year SSC reasoning questions" for a police exam, or "Build a rate limiter middleware" for a software role).
   - Include realistic mock interview/exam questions with appropriate depth.
`


function sanitizePlanUrls(plan: GeneratedStudyPlan): GeneratedStudyPlan {
  if (!plan?.weeks || !Array.isArray(plan.weeks)) return plan
  for (const week of plan.weeks) {
    if (Array.isArray(week.resources)) {
      for (const res of week.resources) {
        res.url = resolveReliableUrl(res.url, res.title, week.topic)
      }
    }
  }
  return plan
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { job, candidateSkills, skillGaps, evaluation } = body

    const jobTitle = job?.title || "Software Engineer"
    const company = job?.company || "Target Company"
    const requiredSkills = job?.requiredSkills || []
    const gaps = skillGaps || []
    const candidateCurrentSkills = candidateSkills || []
    const interviewFeedback = evaluation?.improvements || []
    const interviewScore = evaluation?.overall

    const prompt = `Target Role: ${jobTitle}
Company: ${company}
Target Job Required Skills: ${requiredSkills.join(", ")}
Candidate Existing Skills: ${candidateCurrentSkills.join(", ")}
Identified Skill Gaps to Bridge: ${gaps.join(", ") || requiredSkills.slice(0, 4).join(", ")}
${interviewFeedback.length > 0 ? `Recent Mock Interview Feedback / Gaps Flagged: ${interviewFeedback.join("; ")}` : ""}
${interviewScore ? `Recent Interview Overall Score: ${interviewScore}/100` : ""}

Please generate an in-depth, structured 4-week study plan with authentic, working web resources across the internet (official documentation, engineering blogs, interactive coding practice, and video courses) to prepare this candidate to succeed in their interview for ${jobTitle} at ${company}.`

    try {
      const { object } = await generateObject({
        model: getChatModel("gemini-3.8-flash"),
        system: STUDY_PLAN_SYSTEM_PROMPT,
        schema: studyPlanSchema,
        prompt,
        maxRetries: 1,
      })
      const sanitized = sanitizePlanUrls(object)
      return NextResponse.json({ success: true, plan: sanitized })
    } catch (primaryErr) {
      console.warn("[study-plan] Primary model (gemini-3.8-flash) failed, trying fallback (gemini-3.1-flash-lite):", primaryErr)
      try {
        const { object } = await generateObject({
          model: getChatModel("gemini-3.1-flash-lite"),
          system: STUDY_PLAN_SYSTEM_PROMPT,
          schema: studyPlanSchema,
          prompt,
          maxRetries: 1,
        })
        const sanitized = sanitizePlanUrls(object)
        return NextResponse.json({ success: true, plan: sanitized })
      } catch (fallbackErr) {
        console.error("[study-plan] AI generation failed, using structured fallback plan:", fallbackErr)
        const fallbackPlan = sanitizePlanUrls(createDynamicFallbackPlan(jobTitle, company, requiredSkills, gaps))
        return NextResponse.json({ success: true, plan: fallbackPlan, isFallback: true })
      }
    }
  } catch (error: any) {
    console.error("[study-plan] API error:", error)
    return NextResponse.json({ error: error.message || "Failed to generate study plan" }, { status: 500 })
  }
}

function createDynamicFallbackPlan(title: string, company: string, skills: string[], gaps: string[]): GeneratedStudyPlan {
  const topGaps = gaps.length > 0 ? gaps : skills.length > 0 ? skills : ["Core Concepts", "Subject Knowledge", "Practice & Preparation", "Interview Skills"]
  const week1Skill = topGaps[0] || "Core Fundamentals"
  const week2Skill = topGaps[1] || "Advanced Concepts"
  const week3Skill = topGaps[2] || "Applied Practice"
  const week4Skill = topGaps[3] || "Interview Polish & Mock"

  function makeWeekResources(skill: string) {
    return [
      {
        title: `${skill} — Comprehensive Guide & Tutorials`,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + " " + title + " complete guide tutorial")}`,
        type: "YouTube",
        description: `Video tutorials and comprehensive guides for mastering ${skill} relevant to ${title}.`,
      },
      {
        title: `${skill} — Study Material & Notes`,
        url: `https://www.google.com/search?q=${encodeURIComponent(skill + " " + title + " study material notes")}`,
        type: "Study Material",
        description: `Curated notes, study material, and practice resources for ${skill}.`,
      },
      {
        title: `${skill} — Practice Questions & Tests`,
        url: `https://www.google.com/search?q=${encodeURIComponent(skill + " " + title + " practice questions mock test")}`,
        type: "Practice",
        description: `Practice questions, mock tests, and previous year papers for ${skill}.`,
      },
    ]
  }

  return {
    title: `4-Week Preparation Roadmap: ${title}`,
    targetRole: title,
    company: company,
    summary: `Curated roadmap covering ${topGaps.slice(0, 3).join(", ")} with study material, practice resources, and mock preparation for ${title} at ${company}.`,
    estimatedHoursPerWeek: 10,
    weeks: [
      {
        week: 1,
        topic: `${week1Skill} — Foundations`,
        focusSkills: [week1Skill, "Core Concepts"],
        whyItMatters: `A strong foundation in ${week1Skill} is essential for the ${title} role at ${company}.`,
        whatToLearn: [`Core concepts and fundamentals of ${week1Skill}`, `Key terminology and frameworks`, `Common patterns and best practices`],
        practice: `Complete a comprehensive study session on ${week1Skill} and attempt at least 20 practice questions.`,
        resources: makeWeekResources(week1Skill),
        interviewQuestions: [
          `Explain the key concepts of ${week1Skill} and their importance for ${title}.`,
          `What are the common challenges in ${week1Skill} and how would you address them?`,
        ],
      },
      {
        week: 2,
        topic: `${week2Skill} — Deep Dive`,
        focusSkills: [week2Skill, "Problem Solving"],
        whyItMatters: `${week2Skill} is a critical competency that ${company} evaluates for the ${title} position.`,
        whatToLearn: [`Advanced topics in ${week2Skill}`, `Problem-solving strategies`, `Real-world application scenarios`],
        practice: `Solve 30+ practice problems related to ${week2Skill} under timed conditions.`,
        resources: makeWeekResources(week2Skill),
        interviewQuestions: [
          `How do you approach complex problems in ${week2Skill}?`,
          `Describe a situation where knowledge of ${week2Skill} would be critical for ${title}.`,
        ],
      },
      {
        week: 3,
        topic: `${week3Skill} — Applied Practice`,
        focusSkills: [week3Skill, "Application"],
        whyItMatters: `Practical application of ${week3Skill} demonstrates readiness for real-world responsibilities in ${title}.`,
        whatToLearn: [`Practical applications of ${week3Skill}`, `Case studies and real-world scenarios`, `Common pitfalls and how to avoid them`],
        practice: `Complete a full-length mock test covering ${week3Skill} and review all incorrect answers.`,
        resources: makeWeekResources(week3Skill),
        interviewQuestions: [
          `What are the practical applications of ${week3Skill} in the ${title} role?`,
          `How do you stay updated with developments in ${week3Skill}?`,
        ],
      },
      {
        week: 4,
        topic: `${week4Skill} & Full Mock Preparation`,
        focusSkills: ["Mock Interviews", "Communication", "Confidence"],
        whyItMatters: `Synthesize all your preparation under timed pressure and master confident delivery for the ${title} interview.`,
        whatToLearn: ["Structuring clear, concise answers", "Managing time during exams/interviews", "Building confidence through practice"],
        practice: `Conduct 2 full mock interviews/tests and review all performance areas using PrepSensei AI.`,
        resources: [
          {
            title: `${title} — Mock Interview Preparation (YouTube)`,
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " mock interview preparation tips")}`,
            type: "YouTube",
            description: `Mock interview walkthroughs and preparation tips for ${title}.`,
          },
          {
            title: `${title} — Interview Questions & Answers`,
            url: `https://www.google.com/search?q=${encodeURIComponent(title + " interview questions answers " + company)}`,
            type: "Study Material",
            description: `Common interview questions and model answers for ${title} at ${company}.`,
          },
          {
            title: `${title} — Previous Year Questions & Papers`,
            url: `https://www.google.com/search?q=${encodeURIComponent(title + " previous year questions papers")}`,
            type: "Previous Papers",
            description: `Previous year papers and question archives to understand the exam pattern.`,
          },
        ],
        interviewQuestions: [
          "Tell me about yourself and why you are suited for this role.",
          `What motivated you to apply for ${title} at ${company}?`,
        ],
      },
    ],
  }
}
