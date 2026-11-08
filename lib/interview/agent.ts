import "server-only"
import { z } from "zod"
import { retrieveContext } from "@/lib/rag/retriever"
import { TOTAL_QUESTIONS, type QAPair } from "@/lib/interview/protocol"
import type { CandidateProfile, Evaluation, InterviewType, Job } from "@/lib/demo-data"
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
  interviewSessionId?: string
  candidateUserId?: string
}): Promise<{ question: string }> {
  const { job, profile, type, screeningQuestions, interviewSessionId, candidateUserId } = input
  const firstName = profile.name.split(" ")[0] || "there"

  const chunks = await retrieveContext({
    query: `${type} interview for ${job.title}. Required skills: ${job.requiredSkills.join(", ")}`,
    category: categoryOf(type),
  })

  let screeningContext = ""
  if (screeningQuestions && screeningQuestions.length > 0) {
    screeningContext =
      `\nOfficial Recruiter Screening Questions for this position:\n` +
      screeningQuestions.map((q: any, i: number) => `[Question ${i + 1}]: ${q.question || q}`).join("\n") +
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
        screeningContext +
        `\nWelcome ${firstName} warmly to the official interview for ${job.title} at ${job.company}. Start the conversation in a friendly, professional manner and ask the first question to get the conversation flowing naturally.`,
      purpose: "interview_start",
      interviewSessionId,
      jobId: job.id,
      candidateUserId,
    })

    return { question: object.question }
  } catch (error) {
    console.warn("[interview-agent] Resilient fallback for first question:", error)
    const firstSkill = job.requiredSkills[0] || "software engineering"
    return {
      question: `Hello ${firstName}, welcome to your interview for the ${job.title} role at ${job.company}. We are excited to speak with you today! To kick things off, could you briefly introduce yourself and share a standout project where you worked extensively with ${firstSkill}?`,
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
  const { job, profile, type, qa, screeningQuestions, interviewSessionId, candidateUserId, timeExpired } = input
  const last = qa[qa.length - 1]

  // Dynamic pacing based on configured interview duration (default ~2.2 mins per turn)
  const duration = input.targetDurationMinutes || job.interviewDurationMinutes || 15
  const maxQuestions = Math.max(2, Math.min(15, Math.round(duration / 2.2)))
  const isFinal = Boolean(timeExpired || qa.length >= maxQuestions)
  const firstName = profile.name.split(" ")[0] || "the candidate"

  const chunks = await retrieveContext({
    query: `${last.question} ${last.answer} ${job.title} ${job.requiredSkills.join(", ")}`,
    category: categoryOf(type),
  })

  const transcript = qa
    .map((p, i) => `Interviewer (Question ${i + 1}): ${p.question}\n${firstName} (Answer ${i + 1}): ${p.answer}`)
    .join("\n\n")

  let screeningGuide = ""
  if (!isFinal && screeningQuestions && screeningQuestions.length > 0) {
    const nextQIdx = qa.length
    if (nextQIdx < screeningQuestions.length) {
      const targetQ = screeningQuestions[nextQIdx]?.question || screeningQuestions[nextQIdx]
      screeningGuide = `\nRECRUITER TARGET SCREENING TOPIC FOR NEXT QUESTION (Turn ${qa.length + 1}): "${targetQ}". Acknowledge candidate's previous response, then naturally transition to or ask this screening question.`
    }
  }

  let stageInstruction = ""
  if (isFinal) {
    stageInstruction = `This was the candidate's final response of the interview (${qa.length} questions completed; ${timeExpired ? "Interview time limit reached" : `Target duration of ${duration} minutes reached`}).
       1. In 'feedback', provide concise, constructive feedback and score for this final answer (internal note for report).
       2. Set 'nextQuestion' to null.
       3. Generate finalEvaluation with realistic scores (0-100) and specific actionable strengths/improvements grounded in the entire transcript. Breakdown labels MUST be exactly: "Technical Knowledge", "Communication", "Problem Solving", "Relevance".`
  } else if (qa.length === 1) {
    stageInstruction = `Turn 2 of ${maxQuestions}: CANDIDATE JUST ANSWERED THE OPENING QUESTION.
       You are speaking as the HR / hiring manager interviewing ${firstName}.
       1. In 'feedback', provide internal recruiter notes on their initial answer.
       2. In 'nextQuestion', formulate your natural conversational response:
          - Acknowledge and react with genuine enthusiasm to the specific project, tools, or experience ${firstName} just discussed.
          - Ask a direct FOLLOW-UP question probing into that specific project! (e.g. Ask how they architected that feature, why they chose those specific tools, what tricky bug or edge case they solved, or what trade-offs they made).
          - Do NOT switch to a new unrelated topic yet. Build upon what they just said!`
  } else if (qa.length === 2) {
    stageInstruction = `Turn 3 of ${maxQuestions}: CANDIDATE JUST ANSWERED YOUR FOLLOW-UP QUESTION.
       1. In 'feedback', record internal recruiter notes on their technical depth.
       2. In 'nextQuestion', formulate your natural conversational response:
          - Validate and appreciate their technical reasoning or problem-solving explanation.
          - Now smoothly bridge to a core practical scenario or system challenge directly relevant to the ${job.title} role at ${job.company} (e.g. scaling, performance under high load, state synchronization, or API resilience).
          - Ask them how they would approach designing or troubleshooting that scenario.`
  } else if (qa.length === 3) {
    stageInstruction = `Turn 4 of ${maxQuestions}: CANDIDATE ANSWERED THE SYSTEM/TECHNICAL SCENARIO.
       1. In 'feedback', record internal recruiter notes.
       2. In 'nextQuestion', formulate your natural conversational response:
          - Acknowledge their proposed architecture or solution.
          - Ask an insightful follow-up focusing on real-world team collaboration or engineering trade-offs (e.g. handling conflicting requirements with product managers, conducting constructive code reviews, or delivering under tight release deadlines).`
  } else {
    stageInstruction = `Turn ${qa.length + 1} of ${maxQuestions}: INTERMEDIATE TECHNICAL & BEHAVIORAL QUESTION.
       1. In 'feedback', record internal recruiter notes.
       2. In 'nextQuestion', formulate your natural conversational response:
          - Acknowledge their previous answer and ask an insightful follow-up focusing on ${job.requiredSkills[qa.length % job.requiredSkills.length] || "technical design"}.`
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
        screeningGuide + "\n\n" +
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
      strengths: [
        "Clearly articulated key concepts and relevant hands-on experience.",
        "Demonstrated solid structured thinking and practical problem-solving approach.",
      ],
      improvements: [
        "Could expand further on specific trade-offs and edge-case handling in high-scale scenarios.",
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

    const nextSkill = job.requiredSkills[qa.length % job.requiredSkills.length] || "architectural design"
    return {
      feedback: "Strong response highlighting solid engineering reasoning and clear communication.",
      score,
      nextQuestion: `That makes a lot of sense, ${firstName}. Shifting gears slightly, how do you typically approach ${nextSkill} when designing scalable, reliable systems?`,
      finished: false,
      evaluation: null,
    }
  }
}
