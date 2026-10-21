import type {
  Assessment,
  AssessmentSubmission,
  SimilarityMatch,
  SimilarityResult,
  SimilarityStatus,
} from "@/lib/demo-data"

/**
 * Plagiarism / Similarity Engine — fully deterministic, no LLM, no network.
 *
 * It compares a candidate's free-text answers (short + coding) against the same
 * questions in other submissions of the SAME assessment, using word-level
 * 3-gram shingling and Jaccard similarity. This is a transparent, explainable
 * method suitable for a viva: overlap of word-triplets / union of word-triplets.
 *
 * It does not scrape the internet or call any third-party plagiarism API, and
 * it produces "potential similarity for human review", never an accusation.
 */

const SHINGLE_SIZE = 3
/** Answers shorter than this many words are skipped (too short to compare). */
const MIN_WORDS = 4

const HIGH = 70
const MODERATE = 40

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Remove starter-code lines so a shared template does not inflate similarity. */
function stripStarter(answer: string, starter?: string): string {
  if (!starter) return answer
  const starterLines = new Set(
    starter
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  )
  return answer
    .split("\n")
    .filter((l) => !starterLines.has(l.trim()))
    .join("\n")
}

function shingles(text: string): Set<string> {
  const words = normalize(text).split(" ").filter(Boolean)
  const set = new Set<string>()
  if (words.length < SHINGLE_SIZE) {
    if (words.length) set.add(words.join(" "))
    return set
  }
  for (let i = 0; i <= words.length - SHINGLE_SIZE; i++) {
    set.add(words.slice(i, i + SHINGLE_SIZE).join(" "))
  }
  return set
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let intersection = 0
  for (const s of a) if (b.has(s)) intersection++
  const union = a.size + b.size - intersection
  return union ? intersection / union : 0
}

function statusFor(similarity: number): SimilarityStatus {
  if (similarity >= HIGH) return "high"
  if (similarity >= MODERATE) return "moderate"
  return "low"
}

export function analyzeSimilarity(
  assessment: Assessment,
  answers: Record<string, string>,
  others: AssessmentSubmission[],
): SimilarityResult {
  // Only free-text questions are meaningful; MCQ answers are option indices.
  const comparableQuestions = assessment.questions.filter((q) => q.type !== "mcq")
  const otherSubmissions = others.filter((o) => o.assessmentId === assessment.id && o.answers)

  const matches: SimilarityMatch[] = []

  for (const q of comparableQuestions) {
    const starter = q.type === "coding" ? q.starterCode : undefined
    const candidateText = stripStarter(answers[q.id] ?? "", starter)
    if (normalize(candidateText).split(" ").filter(Boolean).length < MIN_WORDS) continue

    const candidateShingles = shingles(candidateText)
    let best = 0
    let matchedCandidate: string | null = null

    for (const other of otherSubmissions) {
      const otherRaw = other.answers?.[q.id]
      if (!otherRaw) continue
      const otherText = stripStarter(otherRaw, starter)
      if (normalize(otherText).split(" ").filter(Boolean).length < MIN_WORDS) continue
      const sim = jaccard(candidateShingles, shingles(otherText))
      if (sim > best) {
        best = sim
        matchedCandidate = other.candidateName
      }
    }

    const percentage = Math.round(best * 100)
    if (percentage > 0) {
      matches.push({
        questionId: q.id,
        skill: q.skill,
        similarity: percentage,
        matchedCandidate,
        note:
          percentage >= HIGH
            ? "High overlap with another submission."
            : percentage >= MODERATE
              ? "Moderate overlap with another submission."
              : "Low overlap with another submission.",
      })
    }
  }

  const overallSimilarity = matches.length ? Math.max(...matches.map((m) => m.similarity)) : 0
  const status = statusFor(overallSimilarity)
  const reviewRecommended = status !== "low"

  return {
    overallSimilarity,
    status,
    matches: matches.sort((a, b) => b.similarity - a.similarity),
    reviewRecommended,
    explanation:
      otherSubmissions.length === 0
        ? "No other comparable submissions were available, so similarity could not be measured. This is not evidence of originality."
        : reviewRecommended
          ? "Potential similarity with another submission — human review required. This is a signal, not proof of plagiarism."
          : "Answers showed low overlap with other submissions. This is an indicator only, not confirmation of originality.",
  }
}
