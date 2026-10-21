import "server-only"
import { listRecruiterAssessments } from "@/lib/assessments/server"
import { listDecisions } from "@/lib/decisions/server"
import { listRecruiterSubmissions } from "@/lib/submissions/server"
import { reviewRequired } from "@/lib/assessment/review"
import type { HiringDecisionStatus } from "@/lib/demo-data"

export type JobFunnel = {
  jobId: string
  jobTitle: string
  company: string
  assessments: number
  submissions: number
  averageScore: number | null
  decided: number
}

export type SkillAverage = { skill: string; averageScore: number; gradedCount: number }

export type RecruiterAnalytics = {
  activeJobs: number
  publishedAssessments: number
  draftAssessments: number
  submissions: number
  pendingReview: number
  reviewFlagged: number
  averageScore: number | null
  decisions: Record<Exclude<HiringDecisionStatus, "undecided">, number> & { undecided: number }
  jobs: JobFunnel[]
  skills: SkillAverage[]
}

const mean = (nums: number[]) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null)

/**
 * Recruiter analytics derived entirely from persisted rows this recruiter owns.
 * No hardcoded demo figures and no extra AI call — every number here traces
 * back to an assessment, submission or decision record.
 */
export async function getRecruiterAnalytics(recruiterUserId: string): Promise<RecruiterAnalytics> {
  const [assessments, submissions, decisions] = await Promise.all([
    listRecruiterAssessments(recruiterUserId),
    listRecruiterSubmissions(recruiterUserId),
    listDecisions(recruiterUserId),
  ])

  const published = assessments.filter((a) => a.status === "published")
  const scored = submissions.filter((s) => s.result.overallScore !== null)

  const funnels = new Map<string, JobFunnel & { scores: number[] }>()
  for (const a of published) {
    const entry = funnels.get(a.jobId) ?? {
      jobId: a.jobId,
      jobTitle: a.jobTitle,
      company: a.company,
      assessments: 0,
      submissions: 0,
      averageScore: null,
      decided: 0,
      scores: [],
    }
    entry.assessments += 1
    funnels.set(a.jobId, entry)
  }
  for (const s of submissions) {
    const entry = funnels.get(s.jobId)
    if (!entry) continue
    entry.submissions += 1
    if (s.result.overallScore !== null) entry.scores.push(s.result.overallScore)
    if (decisions[s.id]) entry.decided += 1
  }

  // Average score per skill across every graded skill result.
  const bySkill = new Map<string, number[]>()
  for (const s of submissions) {
    for (const sr of s.result.skillResults) {
      if (sr.score === null) continue
      if (!bySkill.has(sr.skill)) bySkill.set(sr.skill, [])
      bySkill.get(sr.skill)!.push(sr.score)
    }
  }

  const decisionCounts = { shortlisted: 0, advanced: 0, rejected: 0, undecided: 0 }
  for (const s of submissions) {
    const d = decisions[s.id]
    if (d && d.status !== "undecided") decisionCounts[d.status] += 1
    else decisionCounts.undecided += 1
  }

  return {
    activeJobs: funnels.size,
    publishedAssessments: published.length,
    draftAssessments: assessments.length - published.length,
    submissions: submissions.length,
    pendingReview: submissions.filter((s) => s.result.reviewStatus === "pending_review").length,
    reviewFlagged: submissions.filter((s) => reviewRequired(s)).length,
    averageScore: mean(scored.map((s) => s.result.overallScore as number)),
    decisions: decisionCounts,
    jobs: Array.from(funnels.values())
      .map(({ scores, ...rest }) => ({ ...rest, averageScore: mean(scores) }))
      .sort((a, b) => b.submissions - a.submissions),
    skills: Array.from(bySkill.entries())
      .map(([skill, scores]) => ({ skill, averageScore: mean(scores) as number, gradedCount: scores.length }))
      .sort((a, b) => b.gradedCount - a.gradedCount || a.skill.localeCompare(b.skill)),
  }
}
