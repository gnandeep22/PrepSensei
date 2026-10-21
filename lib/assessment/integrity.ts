import type { IntegrityResult, IntegritySignal } from "@/lib/demo-data"

/**
 * Integrity Engine — fully deterministic.
 *
 * It inspects non-invasive, application-level signals that the assessment page
 * already captures (completion time, number of submit attempts, and whether a
 * large block of text was pasted into an answer). It NEVER uses webcam, audio,
 * device or physical-world monitoring, and it never calls an LLM.
 *
 * The output is *risk evidence for human review* — a set of signals with a
 * recommendation. It is deliberately worded so it can never be read as proof
 * that a candidate cheated.
 */

export type IntegrityInput = {
  /** Seconds between opening and submitting the assessment, or null if unknown. */
  durationSeconds: number | null
  questionCount: number
  /** How many times the candidate triggered the submit action. */
  submitAttempts: number
  /** How many answers received a large paste (application-level signal). */
  pastedQuestionCount: number
}

/** Below this many seconds per question, completion is flagged for review. */
const MIN_SECONDS_PER_QUESTION = 20

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem ? `${m}m ${rem}s` : `${m}m`
}

export function analyzeIntegrity(input: IntegrityInput): IntegrityResult {
  const { durationSeconds, questionCount, submitAttempts, pastedQuestionCount } = input
  const signals: IntegritySignal[] = []

  // 1) Completion speed relative to the number of questions.
  if (durationSeconds !== null) {
    const threshold = Math.max(30, questionCount * MIN_SECONDS_PER_QUESTION)
    if (durationSeconds < threshold) {
      signals.push({
        kind: "watch",
        label: "Unusually fast submission",
        detail: `Completed in ${formatDuration(durationSeconds)} for ${questionCount} question${
          questionCount === 1 ? "" : "s"
        } — below the ${formatDuration(threshold)} expected minimum.`,
      })
    } else {
      signals.push({
        kind: "ok",
        label: "Normal completion time",
        detail: `Completed in ${formatDuration(durationSeconds)}.`,
      })
    }
  } else {
    signals.push({
      kind: "ok",
      label: "Completion time not recorded",
      detail: "No timing data was available for this submission.",
    })
  }

  // 2) Repeated submission attempts.
  if (submitAttempts > 1) {
    signals.push({
      kind: "watch",
      label: "Repeated submission attempts",
      detail: `The submit action was triggered ${submitAttempts} times.`,
    })
  } else {
    signals.push({
      kind: "ok",
      label: "No repeated submission detected",
      detail: "Submitted in a single attempt.",
    })
  }

  // 3) Large paste into an answer (non-invasive, application-level only).
  if (pastedQuestionCount > 0) {
    signals.push({
      kind: "watch",
      label: "Large paste into answer",
      detail: `A large block of text was pasted into ${pastedQuestionCount} answer${
        pastedQuestionCount === 1 ? "" : "s"
      }.`,
    })
  } else {
    signals.push({
      kind: "ok",
      label: "No large paste detected",
      detail: "Answers were typed rather than pasted in bulk.",
    })
  }

  const hasWatch = signals.some((s) => s.kind === "watch")
  const risk: IntegrityResult["risk"] = hasWatch ? "review" : "low"

  return {
    risk,
    status: risk === "review" ? "Review Recommended" : "Low Risk",
    signals,
    explanation:
      risk === "review"
        ? "Risk evidence for human review — not proof of any wrongdoing. A reviewer should confirm the result before acting on it."
        : "Session signals looked normal. These are indicators only, not a guarantee of integrity.",
  }
}
