import type { AssessmentSubmission } from "@/lib/demo-data"

/**
 * Whether a submission carries an integrity or similarity signal that a human
 * should look at. Kept free of React so both server analytics and client
 * badges apply exactly the same rule.
 */
export function reviewRequired(sub: Pick<AssessmentSubmission, "integrity" | "similarity">): boolean {
  return sub.integrity?.risk === "review" || sub.similarity?.reviewRecommended === true
}
