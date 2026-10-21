import {
  SHORT_ANSWER_PASS,
  type Assessment,
  type AssessmentResult,
  type QuestionResult,
  type SkillResult,
} from "@/lib/demo-data"

/** One short-answer evaluation produced by the AI agent. */
export type ShortEval = { questionId: string; score: number; note: string }

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const mean = (nums: number[]) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0)

/**
 * Deterministically assemble an explainable assessment result.
 *
 * The only non-deterministic input is `shortEvals` (the AI's per-question
 * scores for short answers). MCQs are always graded here; coding answers always
 * require review; short answers require review only when the AI did not return a
 * score for them. The overall score is simply the mean of the graded question
 * percentages, so it can always be traced back to the per-question results.
 */
export function gradeSubmission(
  assessment: Assessment,
  answers: Record<string, string>,
  shortEvals: Record<string, ShortEval>,
): AssessmentResult {
  const questionResults: QuestionResult[] = assessment.questions.map((q) => {
    if (q.type === "mcq") {
      const correct = answers[q.id] === String(q.correctIndex)
      return {
        questionId: q.id,
        skill: q.skill,
        type: "mcq",
        status: correct ? "correct" : "incorrect",
        score: correct ? 100 : 0,
        needsReview: false,
        note: correct ? "Correct answer selected." : "Selected option did not match the answer key.",
      }
    }

    if (q.type === "coding") {
      return {
        questionId: q.id,
        skill: q.skill,
        type: "coding",
        status: "review",
        score: null,
        needsReview: true,
        note: "Requires Technical Review",
      }
    }

    // Short answer: graded by the AI when a score is available, else review.
    const evalResult = shortEvals[q.id]
    if (!evalResult) {
      return {
        questionId: q.id,
        skill: q.skill,
        type: "short",
        status: "review",
        score: null,
        needsReview: true,
        note: "Awaiting evaluation — AI grading was unavailable.",
      }
    }
    const score = clampScore(evalResult.score)
    return {
      questionId: q.id,
      skill: q.skill,
      type: "short",
      status: score >= SHORT_ANSWER_PASS ? "correct" : "incorrect",
      score,
      needsReview: false,
      note: evalResult.note || "Evaluated against the expected key points.",
    }
  })

  const graded = questionResults.filter((r) => r.score !== null) as (QuestionResult & { score: number })[]
  const overallScore = graded.length ? mean(graded.map((r) => r.score)) : null
  const questionsCorrect = questionResults.filter((r) => r.status === "correct").length
  const questionsRequiringReview = questionResults.filter((r) => r.needsReview).length

  // Group by skill, preserving first-seen order.
  const skillOrder: string[] = []
  const bySkill = new Map<string, QuestionResult[]>()
  for (const r of questionResults) {
    if (!bySkill.has(r.skill)) {
      bySkill.set(r.skill, [])
      skillOrder.push(r.skill)
    }
    bySkill.get(r.skill)!.push(r)
  }

  const skillResults: SkillResult[] = skillOrder.map((skill) => {
    const items = bySkill.get(skill)!
    const gradedItems = items.filter((r) => r.score !== null) as (QuestionResult & { score: number })[]
    return {
      skill,
      score: gradedItems.length ? mean(gradedItems.map((r) => r.score)) : null,
      gradedCount: gradedItems.length,
      totalCount: items.length,
      needsReview: gradedItems.length === 0 || items.some((r) => r.needsReview),
    }
  })

  const aiUsed = questionResults.some((r) => r.type === "short" && !r.needsReview)

  return {
    overallScore,
    totalQuestions: questionResults.length,
    gradedCount: graded.length,
    questionsCorrect,
    questionsRequiringReview,
    skillsEvaluated: skillResults.filter((s) => s.score !== null).length,
    skillResults,
    questionResults,
    reviewStatus: questionsRequiringReview > 0 ? "pending_review" : "complete",
    aiUsed,
  }
}
