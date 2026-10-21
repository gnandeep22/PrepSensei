import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react"
import { questionTypeLabels, type AssessmentResult, type QuestionResult } from "@/lib/demo-data"
import { MatchScore, SkillBar, StatCard } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Rank submissions deterministically: by overall score (desc), with
 * un-scorable / fully-pending submissions last. Ties break by fewer
 * questions requiring review, then by name for stability.
 */
export function rankSubmissions<T extends { candidateName: string; result: AssessmentResult }>(subs: T[]): T[] {
  return [...subs].sort((a, b) => {
    const as = a.result.overallScore
    const bs = b.result.overallScore
    if (as === null && bs === null) return a.candidateName.localeCompare(b.candidateName)
    if (as === null) return 1
    if (bs === null) return -1
    if (bs !== as) return bs - as
    if (a.result.questionsRequiringReview !== b.result.questionsRequiringReview) {
      return a.result.questionsRequiringReview - b.result.questionsRequiringReview
    }
    return a.candidateName.localeCompare(b.candidateName)
  })
}

export function skillTone(score: number): "success" | "warning" | "destructive" {
  if (score >= 75) return "success"
  if (score >= 55) return "warning"
  return "destructive"
}

function StatusPill({ result }: { result: AssessmentResult }) {
  if (result.reviewStatus === "pending_review") {
    return (
      <Badge variant="outline" className="text-warning border-warning/40">
        <CircleDashed className="size-3" /> Pending review
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-success border-success/40">
      <CheckCircle2 className="size-3" /> Complete
    </Badge>
  )
}

/** Detailed result shown to the candidate after submitting. */
export function AssessmentResultView({
  result,
  showAnswers = false,
}: {
  result: AssessmentResult
  showAnswers?: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" /> Assessment submitted
              </CardTitle>
              <CardDescription>
                Assessment-based results. Scores reflect the auto-graded questions and are not a guaranteed prediction of job
                performance.
              </CardDescription>
            </div>
            <StatusPill result={result} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <MatchScore score={result.overallScore ?? 0} size="lg" label="score" />
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <StatCard label="Questions correct" value={`${result.questionsCorrect} / ${result.totalQuestions}`} />
            <StatCard label="Requiring review" value={result.questionsRequiringReview} />
            <StatCard label="Skills evaluated" value={result.skillsEvaluated} />
            <StatCard label="Auto-graded" value={`${result.gradedCount} / ${result.totalQuestions}`} />
          </div>
        </CardContent>
      </Card>

      {result.overallScore === null && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            No questions could be auto-graded, so an overall score is not available yet. Your responses are awaiting recruiter
            review.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Skill-level results</CardTitle>
          <CardDescription>Calculated only where enough answers could be evaluated.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {result.skillResults.map((s) =>
            s.score === null ? (
              <div key={s.skill} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{s.skill}</span>
                <Badge variant="outline" className="text-warning border-warning/40">
                  Requires review
                </Badge>
              </div>
            ) : (
              <SkillBar
                key={s.skill}
                label={s.skill}
                value={s.score}
                tone={skillTone(s.score)}
                meta={
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{s.score}%</span>
                    {s.needsReview && <span className="text-xs text-warning">+ review</span>}
                  </span>
                }
              />
            ),
          )}
        </CardContent>
      </Card>

      {showAnswers && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Question breakdown</CardTitle>
            <CardDescription>How each question was scored.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {result.questionResults.map((r, i) => (
              <QuestionResultRow key={r.questionId} result={r} index={i} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function QuestionResultRow({ result, index }: { result: QuestionResult; index: number }) {
  const icon =
    result.status === "correct" ? (
      <CheckCircle2 className="size-4 text-success" />
    ) : result.status === "incorrect" ? (
      <XCircle className="size-4 text-destructive" />
    ) : (
      <CircleDashed className="size-4 text-warning" />
    )
  return (
    <div className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5">{icon}</span>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">
            <span className="mr-2 text-muted-foreground tabular-nums">Q{index + 1}.</span>
            {result.skill} · {questionTypeLabels[result.type]}
          </p>
          <p className="text-xs text-muted-foreground text-pretty">{result.note}</p>
        </div>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {result.score === null ? <span className="text-warning">Review</span> : `${result.score}%`}
      </span>
    </div>
  )
}
