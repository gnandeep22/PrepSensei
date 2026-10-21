import type { CandidateProfile, Evaluation, InterviewType, Job } from "@/lib/demo-data"

/** Number of questions per interview. */
export const TOTAL_QUESTIONS = 5

export type QAPair = { question: string; answer: string }

export type StartRequest = {
  action: "start"
  jobId: string
  /** The full selected Job (e.g. a real JSearch result) so the agent uses it directly. */
  job?: Job
  type: InterviewType
  profile: CandidateProfile
  screeningQuestions?: any[]
}

export type AnswerRequest = {
  action: "answer"
  jobId: string
  /** The full selected Job (e.g. a real JSearch result) so the agent uses it directly. */
  job?: Job
  type: InterviewType
  profile: CandidateProfile
  /** All completed question/answer pairs, including the one just submitted. */
  qa: QAPair[]
  screeningQuestions?: any[]
}

export type InterviewRequest = StartRequest | AnswerRequest

export type StartResponse = { question: string }

export type AnswerResponse = {
  feedback: string
  score: number
  nextQuestion: string | null
  finished: boolean
  evaluation: Evaluation | null
}
