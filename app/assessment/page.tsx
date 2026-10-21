"use client"

import { useMemo, useRef, useState } from "react"
import { AlertTriangle, ArrowLeft, ClipboardCheck, FileQuestion, Loader2 } from "lucide-react"
import { useApp } from "@/lib/store"
import { analyzeIntegrity } from "@/lib/assessment/integrity"
import { analyzeSimilarity } from "@/lib/assessment/plagiarism"
import {
  questionTypeLabels,
  type Assessment,
  type AssessmentQuestion,
  type AssessmentResult,
  type AssessmentSubmission,
} from "@/lib/demo-data"
import { Notice, PageHeader } from "@/components/shared"
import { AssessmentResultView } from "@/components/assessment-result"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

export default function CandidateAssessmentPage() {
  const { assessments } = useApp()
  const published = useMemo(() => assessments.filter((a) => a.status === "published"), [assessments])
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = published.find((a) => a.id === activeId) ?? null

  if (active) {
    return <TakeAssessment assessment={active} onBack={() => setActiveId(null)} />
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-300">
      <PageHeader
        title="Technical Assessments"
        description="Recruiter-published skill assessments. Complete timed challenges and screening questionnaires to benchmark your profile for open positions."
      />

      {published.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileQuestion className="size-9 text-muted-foreground/60" />
            <p className="text-sm font-semibold text-foreground">No Assessments Available Yet</p>
            <p className="max-w-md text-xs text-muted-foreground text-pretty">
              When recruiters post roles with screening questionnaires, they will appear here ready for you to complete.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {published.map((a) => (
            <Card key={a.id} className="flex flex-col justify-between hover:border-primary/40 hover:shadow-xs transition-all duration-200">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold">{a.title}</CardTitle>
                  <Badge variant="outline" className="text-[10px] py-0">{a.difficulty}</Badge>
                </div>
                <CardDescription className="text-xs">
                  {a.jobTitle} · {a.company}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[11px]">{a.questions.length} questions</Badge>
                  <Badge variant="outline" className="text-[11px]">Proctored Evaluation</Badge>
                </div>
                <Button onClick={() => setActiveId(a.id)} className="w-full gap-1.5 mt-1">
                  <ClipboardCheck className="size-4" /> Start Assessment
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function TakeAssessment({ assessment, onBack }: { assessment: Assessment; onBack: () => void }) {
  const { profile, addSubmission, submissions } = useApp()
  // Seed coding answers with their starter code so the editor is prefilled.
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {}
    for (const q of assessment.questions) {
      if (q.type === "coding" && q.starterCode) seed[q.id] = q.starterCode
    }
    return seed
  })
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Non-invasive, application-level session signals for the Integrity Engine.
  const startedAtRef = useRef<number>(Date.now())
  const submitAttemptsRef = useRef<number>(0)
  const pastedIdsRef = useRef<Set<string>>(new Set())

  function markPasted(questionId: string) {
    pastedIdsRef.current.add(questionId)
  }

  async function submit() {
    submitAttemptsRef.current += 1
    setWorking(true)
    setError(null)
    try {
      const res = await fetch("/api/assessment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "evaluate", assessment, answers }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { result: AssessmentResult }
      setResult(data.result)

      // Deterministic post-evaluation analysis (no LLM). Runs client-side so it
      // can use the session signals and the existing submissions for comparison,
      // and still works when the AI Gateway is unavailable.
      const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000)
      const integrity = analyzeIntegrity({
        durationSeconds,
        questionCount: assessment.questions.length,
        submitAttempts: submitAttemptsRef.current,
        pastedQuestionCount: pastedIdsRef.current.size,
      })
      const similarity = analyzeSimilarity(assessment, answers, submissions)

      // Record the submission so recruiters can rank it. No database — this
      // lives in the shared in-memory store, matching the rest of the demo.
      const submission: AssessmentSubmission = {
        id: `sub-${Date.now().toString(36)}`,
        assessmentId: assessment.id,
        assessmentTitle: assessment.title,
        jobId: assessment.jobId,
        jobTitle: assessment.jobTitle,
        company: assessment.company,
        candidateName: profile.name,
        submittedAt: "Just now",
        result: data.result,
        answers,
        integrity,
        similarity,
      }
      addSubmission(submission)
    } catch {
      setError("Could not evaluate the assessment right now. Please try submitting again in a moment.")
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <PageHeader
        title={assessment.title}
        description={`${assessment.jobTitle} · ${assessment.company}`}
        actions={
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" /> Back to assessments
          </Button>
        }
      />

      {result ? (
        <>
          {/* Candidate view hides the underlying answer key, but shows how each
              question was scored via the per-question notes. */}
          <AssessmentResultView result={result} showAnswers />
          <div>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="size-4" /> Back to assessments
            </Button>
          </div>
        </>
      ) : (
        <>
          <Notice>
            Answer every question, then submit. Multiple-choice answers are graded automatically, short answers are evaluated
            with AI, and coding answers are sent for technical review.
          </Notice>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {assessment.questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                value={answers[q.id] ?? ""}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                onLargePaste={() => markPasted(q.id)}
              />
            ))}
          </div>
          <div>
            <Button onClick={submit} disabled={working}>
              {working ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Evaluating…
                </>
              ) : (
                "Submit assessment"
              )}
            </Button>
          </div>
        </>
      )}
    </>
  )
}

/** Pasting more than this many characters at once is treated as a "large paste". */
const LARGE_PASTE_CHARS = 40

function QuestionCard({
  question,
  index,
  value,
  onChange,
  onLargePaste,
}: {
  question: AssessmentQuestion
  index: number
  value: string
  onChange: (v: string) => void
  onLargePaste: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium">
            <span className="mr-2 text-muted-foreground tabular-nums">Q{index + 1}.</span>
            {question.question}
          </p>
          <Badge variant="secondary" className="shrink-0">
            {questionTypeLabels[question.type]}
          </Badge>
        </div>

        {question.type === "mcq" ? (
          <div className="flex flex-col gap-2">
            {question.options.map((opt, i) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`answer-${question.id}`}
                  checked={value === String(i)}
                  onChange={() => onChange(String(i))}
                  className="size-4 accent-[var(--color-primary)]"
                />
                {opt}
              </label>
            ))}
          </div>
        ) : (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={(e) => {
              if (e.clipboardData.getData("text").length > LARGE_PASTE_CHARS) onLargePaste()
            }}
            rows={question.type === "coding" ? 6 : 3}
            placeholder={question.type === "coding" ? "Write your solution here" : "Type your answer here"}
            className={question.type === "coding" ? "font-mono text-xs" : undefined}
          />
        )}
      </CardContent>
    </Card>
  )
}
