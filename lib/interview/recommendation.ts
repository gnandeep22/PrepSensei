import type { AssessmentSubmission } from "@/lib/demo-data"
import { reviewRequired } from "@/components/integrity-panel"

/**
 * Deterministic hiring recommendation — decision SUPPORT for a recruiter, never
 * an automated hiring verdict. It blends the transparent assessment score with
 * the interview score (when present) and always defers to a human when the
 * submission is flagged for review or still awaiting grading.
 *
 * There are no network or LLM calls here: given the same submission it always
 * returns the same result, and every tier is explained by the reasons it emits.
 */
export type RecommendationTier = "strong" | "consider" | "hold"

export type Recommendation = {
  tier: RecommendationTier
  label: string
  /** The combined 0–100 signal, or null when nothing could be scored. */
  blended: number | null
  /** Human-readable justifications citing the concrete signals used. */
  reasons: string[]
}

/**
 * Blend the assessment overall with the interview overall, weighting the
 * assessment more heavily (0.65) because it is objectively graded, and the
 * interview less (0.35). When only one exists, that score is used directly.
 */
function blendScores(assessment: number | null, interview: number | null): number | null {
  if (assessment !== null && interview !== null) {
    return Math.round(assessment * 0.65 + interview * 0.35)
  }
  return assessment ?? interview ?? null
}

export function recommendCandidate(sub: AssessmentSubmission): Recommendation {
  const assessment = sub.result.overallScore
  const interview = sub.interview?.overall ?? null
  const blended = blendScores(assessment, interview)

  const reasons: string[] = []

  // Assessment evidence.
  if (assessment === null) {
    reasons.push("Assessment could not be auto-scored yet — answers are awaiting review.")
  } else {
    reasons.push(
      `Assessment score of ${assessment}% across ${sub.result.skillsEvaluated} evaluated skill${
        sub.result.skillsEvaluated === 1 ? "" : "s"
      }.`,
    )
  }

  // Interview evidence (optional).
  if (interview !== null && sub.interview) {
    const topStrength = sub.interview.strengths[0]
    reasons.push(
      `Interview score of ${interview}%${topStrength ? ` — noted strength: ${topStrength.toLowerCase()}.` : "."}`,
    )
  } else {
    reasons.push("No AI interview on file — consider inviting the candidate to complete one.")
  }

  // Human-review gates always win: never auto-recommend a flagged/pending candidate.
  const flagged = reviewRequired(sub)
  const pending = sub.result.reviewStatus === "pending_review"

  if (flagged) {
    reasons.push("Integrity or similarity signals are flagged for human review before any decision.")
  }
  if (pending && assessment !== null) {
    reasons.push(`${sub.result.questionsRequiringReview} answer(s) still require manual grading.`)
  }

  if (flagged || pending || blended === null) {
    return {
      tier: "hold",
      label: "Hold for review",
      blended,
      reasons,
    }
  }

  if (blended >= 80) {
    return { tier: "strong", label: "Strong candidate", blended, reasons }
  }
  if (blended >= 65) {
    return { tier: "consider", label: "Worth considering", blended, reasons }
  }
  return { tier: "hold", label: "Hold for review", blended, reasons }
}
