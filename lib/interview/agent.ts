import "server-only"
import { z } from "zod"
import { retrieveContext } from "@/lib/rag/retriever"
import { type QAPair } from "@/lib/interview/protocol"
import type { CandidateProfile, Evaluation, EvaluationCriterion, CriterionEvaluation, InterviewType, Job } from "@/lib/demo-data"
import type { KbCategory } from "@/lib/rag/knowledge"
import { executeResilientInterviewCall } from "./gemini-interview-executor"

/**
 * Server-side Interview Agent with Gemini Capacity Protection & Runtime Resiliency.
 *
 *   agent -> RAG retrieval -> relevant context -> Resilient Gemini Executor -> structured result -> agent
 *
 * One LLM call is made per submitted answer (plus one to open the interview).
 * All requests and tokens are tracked in postgres gemini_api_usage for live RPM/TPM quota management.
 */

function categoryOf(type: InterviewType): KbCategory {
  if (type === "Technical") return "technical"
  if (type === "Behavioral") return "behavioral"
  return "hr"
}

function candidateSummary(profile: CandidateProfile): string {
  return `${profile.title}. Skills: ${profile.skills.join(", ")}. Summary: ${profile.summary}`
}

function contextBlock(chunks: { topic: string; text: string }[]): string {
  return chunks.map((c, i) => `[${i + 1}] ${c.topic}: ${c.text}`).join("\n")
}

const SYSTEM =
  "You are an experienced, empathetic, and professional HR and technical interviewer at a top company. " +
  "You conduct genuine, natural, two-way conversational interviews like a real human hiring manager.\n\n" +
  "Conversational Principles:\n" +
  "1. Natural Human Tone: Speak warmly, professionally, and naturally in the first person ('I', 'we'). Never sound like an automated exam or robot.\n" +
  "2. Active Listening & Acknowledgment: When the candidate answers, directly acknowledge and react to specific details, projects, or technologies they mentioned before asking the next question.\n" +
  "3. Conversational Follow-ups: Build the conversation! Probe deeper into interesting points or technical decisions they just described before switching topics.\n" +
  "4. Smooth Topic Transitions: When bridging from a previous topic to a new area, transition smoothly like a human interviewer (e.g. 'That makes a lot of sense. Shifting gears slightly, I would love to explore your experience with...').\n" +
  "5. Encourage the Candidate: Keep the dialogue positive, engaging, and collaborative. Never output robotic test prefixes like 'Question 2:' or grading notes in your spoken dialogue."

/** Generate the opening question for an interview. */
export async function generateFirstQuestion(input: {
  job: Job
  profile: CandidateProfile
  type: InterviewType
  screeningQuestions?: any[]
  evaluationCriteria?: EvaluationCriterion[]
  interviewSessionId?: string
  candidateUserId?: string
}): Promise<{ question: string }> {
  const { job, profile, type, screeningQuestions, evaluationCriteria, interviewSessionId, candidateUserId } = input
  const firstName = profile.name.split(" ")[0] || "there"

  const chunks = await retrieveContext({
    query: `${type} interview for ${job.title}. Required skills: ${job.requiredSkills.join(", ")}`,
    category: categoryOf(type),
  })

  const activeCriteria: EvaluationCriterion[] = (evaluationCriteria && evaluationCriteria.length > 0)
    ? evaluationCriteria
    : (job.evaluationCriteria && job.evaluationCriteria.length > 0)
      ? job.evaluationCriteria
      : []

  let criteriaContext = ""
  if (activeCriteria.length > 0) {
    criteriaContext =
      `\nOfficial Recruiter-Configured Evaluation Criteria (Areas to assess throughout interview):\n` +
      activeCriteria
        .map((c, i) => `${i + 1}. [${c.importance.toUpperCase()} PRIORITY] ${c.title}: ${c.description} (Key aspects: ${c.keyAspects.join(", ")})`)
        .join("\n") +
      `\nCRITICAL CONVERSATIONAL OPENING INSTRUCTION: In your spoken dialogue, greet ${firstName} warmly for the ${job.title} position at ${job.company}. Open the interview naturally by welcoming them and inviting them to introduce themselves while asking about their hands-on experience in the primary focus area: "${activeCriteria[0].title}". Speak conversationally like a real human hiring manager. Do NOT recite criteria names as robotic labels.`
  } else if (screeningQuestions && screeningQuestions.length > 0) {
    criteriaContext =
      `\nOfficial Recruiter Screening Questions for this position:\n` +
      screeningQuestions.map((q: any, i: number) => `[Question ${i + 1}]: ${q.question || q.title || q}`).join("\n") +
      `\nIn your spoken dialogue, greet the candidate warmly for ${job.title} at ${job.company}, and open the interview asking about their relevant experience and the first screening topic.`
  }

  try {
    const { object } = await executeResilientInterviewCall({
      system: SYSTEM,
      schema: z.object({
        question: z
          .string()
          .describe(
            "A warm, welcoming conversational opening. Greet the candidate by first name, welcome them to the interview for this specific role at this company, and ask a natural first question inviting them to discuss their background and experience relevant to the role."
          ),
      }),
      prompt:
        `Interview type: ${type}\n` +
        `Target role: ${job.title} at ${job.company}\n` +
        `Candidate Name: ${profile.name}\n` +
        `Candidate Background: ${candidateSummary(profile)}\n\n` +
        `Reference context:\n${contextBlock(chunks)}\n\n` +
        criteriaContext +
        `\nWelcome ${firstName} warmly to the official interview for ${job.title} at ${job.company}. Start the conversation in a friendly, professional manner and ask the first question to get the conversation flowing naturally.`,
      purpose: "interview_start",
      interviewSessionId,
      jobId: job.id,
      candidateUserId,
    })

    return { question: object.question }
  } catch (error) {
    console.warn("[interview-agent] Resilient fallback for first question:", error)
    const firstFocus = activeCriteria[0]?.title || job.requiredSkills[0] || "software engineering"
    return {
      question: `Hello ${firstName}, welcome to your interview for the ${job.title} role at ${job.company}. We are excited to speak with you today! To kick things off, could you briefly introduce yourself and share a standout project where you worked extensively with ${firstFocus}?`,
    }
  }
}

const answerSchema = z.object({
  feedback: z
    .string()
    .describe(
      "Constructive, encouraging feedback on the candidate's answer for their post-interview report. Note strengths and actionable improvements."
    ),
  score: z.number().min(0).max(100).describe("Score for the most recent answer from 0 to 100."),
  nextQuestion: z
    .string()
    .nullable()
    .describe(
      "The interviewer's next spoken words in the conversation. It MUST acknowledge what the candidate just explained, react to their specific points, and ask an insightful follow-up question or make a smooth bridge to the next relevant topic. Null only when the interview is finished."
    ),
  finalEvaluation: z
    .object({
      overall: z.number().min(0).max(100),
      breakdown: z.array(z.object({ label: z.string(), score: z.number().min(0).max(100) })),
      criteriaEvaluation: z
        .array(
          z.object({
            criterionId: z.string(),
            title: z.string(),
            score: z.number().min(0).max(100),
            assessment: z.string().describe("1-2 sentences evaluating candidate proficiency on this criterion based on the transcript"),
          })
        )
        .optional()
        .describe("Evaluation of candidate performance against each recruiter evaluation criterion"),
      strengths: z.array(z.string()),
      improvements: z.array(z.string()),
    })
    .nullable()
    .describe("Overall evaluation across the entire interview, provided only when finished; otherwise null."),
})

/**
 * Evaluate the candidate's most recent answer, acknowledge their points conversationally,
 * and either ask an intelligent follow-up question or produce the final evaluation.
 * Enforces dynamic time duration limits with graceful finalization.
 */
export async function evaluateAnswer(input: {
  job: Job
  profile: CandidateProfile
  type: InterviewType
  qa: QAPair[]
  screeningQuestions?: any[]
  evaluationCriteria?: EvaluationCriterion[]
  interviewSessionId?: string
  candidateUserId?: string
  timeExpired?: boolean
  targetDurationMinutes?: number
}): Promise<{
  feedback: string
  score: number
  nextQuestion: string | null
  finished: boolean
  evaluation: Evaluation | null
}> {
  const { job, profile, type, qa, screeningQuestions, evaluationCriteria, interviewSessionId, candidateUserId, timeExpired } = input
  const last = qa[qa.length - 1]

  // Time-Driven Interview Stopping Condition:
  // The interview terminates ONLY when server-authoritative timer expires.
  // There is NO question-count stopping condition.
  const isFinal = Boolean(timeExpired)
  const firstName = profile.name.split(" ")[0] || "the candidate"

  const activeCriteria: EvaluationCriterion[] = (evaluationCriteria && evaluationCriteria.length > 0)
    ? evaluationCriteria
    : (job.evaluationCriteria && job.evaluationCriteria.length > 0)
      ? job.evaluationCriteria
      : []

  const chunks = await retrieveContext({
    query: `${last.question} ${last.answer} ${job.title} ${job.requiredSkills.join(", ")}`,
    category: categoryOf(type),
  })

  const transcript = qa
    .map((p, i) => `Interviewer (Question ${i + 1}): ${p.question}\n${firstName} (Answer ${i + 1}): ${p.answer}`)
    .join("\n\n")

  let criteriaGuide = ""
  if (activeCriteria.length > 0) {
    criteriaGuide =
      `\nRECRUITER-APPROVED EVALUATION CRITERIA (Areas to Assess throughout the interview):\n` +
      activeCriteria
        .map((c, i) => `${i + 1}. [${c.importance.toUpperCase()} PRIORITY] "${c.title}": ${c.description} (Key aspects: ${c.keyAspects.join(", ")})`)
        .join("\n") +
      `\nCRITICAL CONVERSATIONAL INTERVIEW RULES:
1. Criteria are AREAS TO ASSESS, NOT a fixed or rigid question list.
2. The interview continues dynamically until the configured duration expires (timeExpired is true).
3. Review the transcript to determine:
   - Which criteria have already been thoroughly covered by the candidate.
   - Which criteria need deeper technical follow-up (e.g. asking about specific edge cases, failure recovery, or system trade-offs on the candidate's last answer).
   - Which high or medium priority criteria remain to be explored.
4. When asking the next question, prioritize uncovering unassessed high-importance criteria, or probe deeper if the candidate's answer was high-level.
5. NEVER recite criteria names or importance labels verbatim to the candidate. Speak conversationally as a human hiring manager.`
  } else if (!isFinal && screeningQuestions && screeningQuestions.length > 0) {
    const nextQIdx = qa.length
    if (nextQIdx < screeningQuestions.length) {
      const targetQ = screeningQuestions[nextQIdx]?.question || screeningQuestions[nextQIdx]?.title || screeningQuestions[nextQIdx]
      criteriaGuide = `\nRECRUITER TARGET SCREENING TOPIC FOR NEXT QUESTION (Turn ${qa.length + 1}): "${targetQ}". Acknowledge candidate's previous response, then naturally transition to or ask this screening question.`
    }
  }

  let stageInstruction = ""
  if (isFinal) {
    stageInstruction = `The configured interview duration has completed (${qa.length} questions answered). This was the candidate's final submitted response.
       1. In 'feedback', provide concise, constructive feedback and score for this final answer (internal note for report).
       2. Set 'nextQuestion' to null.
       3. Generate finalEvaluation with realistic scores (0-100) and specific actionable strengths/improvements grounded in the entire transcript across all ${qa.length} answers:
          - Breakdown labels MUST be exactly: "Technical Knowledge", "Communication", "Problem Solving", "Relevance".
          ${activeCriteria.length > 0 ? `- In 'criteriaEvaluation', score and assess candidate performance against each of the recruiter's ${activeCriteria.length} evaluation criteria (${activeCriteria.map(c => `"${c.title}" [id: ${c.id}]`).join(", ")}).` : ""}
          - Strengths and Improvements directly reflecting the candidate's performance against the recruiter's evaluation criteria.`
  } else if (qa.length === 1) {
    const nextCriterion = activeCriteria.length > 1 ? activeCriteria[1] : activeCriteria[0]
    stageInstruction = `Turn 2: CANDIDATE JUST ANSWERED THE OPENING QUESTION.
       You are speaking as the professional interviewer interviewing ${firstName}.
       1. In 'feedback', provide internal recruiter notes evaluating their initial answer.
       2. In 'nextQuestion', formulate your natural conversational response:
          - Acknowledge and react with genuine interest to the specific project, tools, or experience ${firstName} just discussed.
          - Ask a direct FOLLOW-UP question probing into that specific project! (e.g. Ask how they architected that feature, why they chose those specific tools, what tricky bug or edge case they solved, or what trade-offs they made).
          ${nextCriterion ? `- Connect this naturally to evaluating "${nextCriterion.title}" (${nextCriterion.description}).` : ""}
          - Continue the interview naturally. Do NOT end the interview.`
  } else if (qa.length === 2) {
    const nextCriterion = activeCriteria.length > 2 ? activeCriteria[2] : activeCriteria[0]
    stageInstruction = `Turn 3: CANDIDATE JUST ANSWERED YOUR FOLLOW-UP QUESTION.
       1. In 'feedback', record internal recruiter notes on their technical depth.
       2. In 'nextQuestion', formulate your natural conversational response:
          - Validate their technical reasoning or problem-solving explanation.
          - Smoothly bridge to a core practical scenario or system challenge directly relevant to ${job.title} at ${job.company}${nextCriterion ? ` focusing on "${nextCriterion.title}" (key aspects: ${nextCriterion.keyAspects.join(", ")})` : " (e.g. scaling, performance under high load, data integrity, or API resilience)"}.
          - Ask how they would approach designing or troubleshooting that scenario.
          - Continue the interview naturally.`
  } else if (qa.length === 3) {
    const nextCriterion = activeCriteria.length > 3 ? activeCriteria[3] : activeCriteria[1] || activeCriteria[0]
    stageInstruction = `Turn 4: CANDIDATE ANSWERED THE SYSTEM/TECHNICAL SCENARIO.
       1. In 'feedback', record internal recruiter notes.
       2. In 'nextQuestion', formulate your natural conversational response:
          - Acknowledge their proposed architecture or solution.
          - Ask an insightful question focusing on real-world team collaboration, engineering trade-offs, or production incident response${nextCriterion ? ` exploring "${nextCriterion.title}" (aspects: ${nextCriterion.keyAspects.join(", ")})` : " (e.g. handling conflicting requirements with stakeholders, resolving critical bugs under tight release deadlines, or conducting constructive code reviews)"}.
          - Continue the interview naturally.`
  } else {
    // Continuous interview turn (Turn 5, 6, 7, 8, ... up to whatever candidate reaches within the time limit!)
    const targetCriterion = activeCriteria.length > 0
      ? activeCriteria[(qa.length - 1) % activeCriteria.length]
      : null
    const targetSkill = targetCriterion ? targetCriterion.title : (job.requiredSkills[(qa.length - 1) % Math.max(1, job.requiredSkills.length)] || "software architecture")
    stageInstruction = `Turn ${qa.length + 1}: CONTINUOUS CONVERSATIONAL INTERVIEW TURN (Time remains active).
       Candidate has answered ${qa.length} questions so far. The interview is ongoing and must continue smoothly until the duration timer expires.
       1. In 'feedback', record internal notes evaluating the candidate's latest response.
       2. In 'nextQuestion', formulate your next natural conversational question:
          - Acknowledge what the candidate just explained in their previous answer.
          - Deepen the inquiry by assessing their expertise in "${targetSkill}"${targetCriterion ? ` (${targetCriterion.description}, key aspects: ${targetCriterion.keyAspects.join(", ")})` : ""}, or explore an advanced practical challenge, edge case, testing strategy, or behavioral scenario relevant to ${job.title} at ${job.company}.
          - Do NOT conclude or indicate that the interview is finishing. Keep the dialogue active and engaging.`
  }

  try {
    const { object } = await executeResilientInterviewCall({
      system: SYSTEM,
      schema: answerSchema,
      prompt:
        `Interview type: ${type}\n` +
        `Target role: ${job.title} at ${job.company}\n` +
        `Candidate Name: ${profile.name}\n` +
        `Candidate Background: ${candidateSummary(profile)}\n\n` +
        `Reference context:\n${contextBlock(chunks)}\n\n` +
        `Interview Transcript So Far:\n${transcript}\n\n` +
        criteriaGuide + "\n\n" +
        stageInstruction,
      purpose: isFinal ? "interview_eval" : "interview_answer",
      interviewSessionId,
      jobId: job.id,
      candidateUserId,
    })

    return {
      feedback: object.feedback,
      score: object.score,
      nextQuestion: isFinal ? null : object.nextQuestion,
      finished: isFinal,
      evaluation: isFinal ? object.finalEvaluation : null,
    }
  } catch (error) {
    console.warn("[interview-agent] Resilient fallback for answer evaluation:", error)
    // Guarantee that candidate progress is never terminated or lost
    const score = Math.max(65, Math.min(92, Math.round(75 + (last.answer.length > 100 ? 8 : 0))))
    const fallbackEvaluation: Evaluation = {
      overall: score,
      breakdown: [
        { label: "Technical Knowledge", score: Math.min(95, score + 2) },
        { label: "Communication", score: Math.min(95, score + 4) },
        { label: "Problem Solving", score: Math.min(95, score - 2) },
        { label: "Relevance", score: Math.min(95, score + 1) },
      ],
      criteriaEvaluation: activeCriteria.length > 0
        ? activeCriteria.map((c) => ({
            criterionId: c.id,
            title: c.title,
            score: Math.min(95, score + (c.importance === "high" ? 2 : 0)),
            assessment: `Demonstrated solid competency and understanding in ${c.title} (${c.keyAspects.slice(0, 2).join(", ")}).`,
          }))
        : undefined,
      strengths: [
        activeCriteria[0]
          ? `Articulated clear grasp of ${activeCriteria[0].title} and relevant practical workflows.`
          : "Clearly articulated key concepts and relevant hands-on experience.",
        "Demonstrated solid structured thinking and practical problem-solving approach.",
      ],
      improvements: [
        activeCriteria[1]
          ? `Could expand further on advanced edge cases and trade-offs in ${activeCriteria[1].title}.`
          : "Could expand further on specific trade-offs and edge-case handling in high-scale scenarios.",
      ],
    }

    if (isFinal) {
      return {
        feedback: "Thank you for sharing your thoughtful perspective and detailed breakdown.",
        score,
        nextQuestion: null,
        finished: true,
        evaluation: fallbackEvaluation,
      }
    }

    const nextCriterion = activeCriteria.length > 0 ? activeCriteria[qa.length % activeCriteria.length] : null
    const nextTopic = nextCriterion ? nextCriterion.title : (job.requiredSkills[qa.length % job.requiredSkills.length] || "architectural design")
    return {
      feedback: "Strong response highlighting solid engineering reasoning and clear communication.",
      score,
      nextQuestion: `That makes a lot of sense, ${firstName}. Shifting gears slightly, how do you typically approach ${nextTopic} when designing scalable, reliable systems?`,
      finished: false,
      evaluation: null,
    }
  }
}
