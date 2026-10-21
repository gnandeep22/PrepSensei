"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react"
import { useApp } from "@/lib/store"
import {
  demoJobs,
  questionTypeLabels,
  type Assessment,
  type AssessmentConfig,
  type AssessmentQuestion,
  type Difficulty,
  type QuestionType,
} from "@/lib/demo-data"
import { JobSelect } from "@/components/job-select"
import { Field, Notice, PageHeader, Pipeline, nativeSelectClass } from "@/components/shared"
import { QuestionEditor } from "@/components/assessment-question-editor"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AgenticJobCreator } from "@/components/recruiter/agentic-job-creator"

const builderSteps = [
  { label: "Job + Configuration", description: "Pick a job and what to evaluate" },
  { label: "Assessment Agent", description: "LLM drafts grounded questions" },
  { label: "Recruiter Review", description: "Edit, delete, regenerate" },
  { label: "Publish", description: "Send to candidates" },
]

const allTypes: QuestionType[] = ["mcq", "short", "coding"]
const difficulties: Difficulty[] = ["Easy", "Medium", "Hard"]

export default function AssessmentBuilderPage() {
  const { assessments, saveAssessment, deleteAssessment, allJobs } = useApp()
  const availableJobs = allJobs && allJobs.length > 0 ? allJobs : demoJobs

  const [builderMode, setBuilderMode] = useState<"agentic" | "manual">("agentic")
  const [jobId, setJobId] = useState(availableJobs[0].id)
  const [title, setTitle] = useState("")
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium")
  const [questionCount, setQuestionCount] = useState(5)
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(["mcq", "short"])
  const [topics, setTopics] = useState<string[]>(availableJobs[0].requiredSkills)

  const [draft, setDraft] = useState<AssessmentQuestion[] | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)
  const [published, setPublished] = useState<string | null>(null)

  const job = useMemo(() => availableJobs.find((j) => j.id === jobId) ?? availableJobs[0], [availableJobs, jobId])

  function onJobChange(id: string, newJob?: any) {
    setJobId(id)
    const j = newJob ?? availableJobs.find((x) => x.id === id)
    setTopics(j ? j.requiredSkills : [])
    setDraft(null)
    setPublished(null)
  }

  function toggleType(t: QuestionType) {
    setQuestionTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }
  function toggleTopic(skill: string) {
    setTopics((prev) => (prev.includes(skill) ? prev.filter((x) => x !== skill) : [...prev, skill]))
  }

  function currentConfig(): AssessmentConfig {
    return {
      title: title.trim() || `${job.title} Assessment`,
      jobId,
      difficulty,
      questionCount,
      questionTypes,
      topics,
    }
  }

  async function generate() {
    if (questionTypes.length === 0) {
      setError("Select at least one question type.")
      return
    }
    setWorking(true)
    setError(null)
    setPublished(null)
    try {
      const res = await fetch("/api/assessment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", config: currentConfig(), job }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDraft(data.questions as AssessmentQuestion[])
      setFallback(Boolean(data.fallback))
    } catch {
      setError("The Assessment Agent is unavailable right now. Please try again in a moment.")
    } finally {
      setWorking(false)
    }
  }

  function updateQuestion(q: AssessmentQuestion) {
    setDraft((prev) => (prev ? prev.map((x) => (x.id === q.id ? q : x)) : prev))
  }
  function removeQuestion(id: string) {
    setDraft((prev) => (prev ? prev.filter((x) => x.id !== id) : prev))
  }

  function publish() {
    if (!draft || draft.length === 0) return
    const assessment: Assessment = {
      id: `assessment-${Date.now().toString(36)}`,
      title: title.trim() || `${job.title} Assessment`,
      jobId,
      jobTitle: job.title,
      company: job.company,
      difficulty,
      status: "published",
      questions: draft,
      createdAt: "Just now",
    }
    saveAssessment(assessment)
    setPublished(assessment.title)
    setDraft(null)
    setTitle("")
  }

  const activeStep = published ? 3 : draft ? 2 : 0

  return (
    <>
      <PageHeader
        title="Assessment Builder"
        description="Configure an assessment for a job, let the Assessment Agent draft questions, review them, then publish to candidates."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/recruiter" />}>
            Back to dashboard
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={builderMode === "agentic" ? "default" : "outline"}
          onClick={() => setBuilderMode("agentic")}
          className="gap-2"
        >
          <Sparkles className="size-4 text-primary" /> Autonomous Agentic Creator (Prompt → JD &amp; Interview)
        </Button>
        <Button
          variant={builderMode === "manual" ? "default" : "outline"}
          onClick={() => setBuilderMode("manual")}
          className="gap-2"
        >
          <ClipboardList className="size-4" /> Manual Step-by-Step Builder
        </Button>
      </div>

      {builderMode === "agentic" ? (
        <AgenticJobCreator
          onJobPublished={(result, draftObj) => {
            if (draftObj && result.jobId) {
              saveAssessment({
                id: result.assessmentId,
                title: `${draftObj.title} Technical Screening`,
                jobId: result.jobId,
                jobTitle: draftObj.title,
                company: draftObj.company || "Hiring Partner",
                difficulty: "Medium",
                status: "published",
                questions: (draftObj.interviewQuestions || []).map((q: any, idx: number) => ({
                  id: `q-${idx + 1}`,
                  type: "short" as const,
                  skill: q.skill || "Technical",
                  difficulty: "Medium" as const,
                  question: q.question,
                  options: [],
                  correctIndex: 0,
                  explanation: "",
                  keyPoints: q.keyPoints || [],
                })),
                createdAt: new Date().toISOString(),
              })
              setPublished(draftObj.title)
            }
          }}
        />
      ) : (
        <>
          <Card>
            <CardContent>
              <Pipeline steps={builderSteps} activeIndex={activeStep} />
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {published && (
            <Notice>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <span>
                  <strong>{published}</strong> is published. Candidates can now see it on the{" "}
                  <Link href="/assessment" className="font-medium text-primary underline underline-offset-2">
                    Assessments
                  </Link>{" "}
                  page.
                </span>
              </span>
            </Notice>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Questions are grounded in the selected job&apos;s required skills.</CardDescription>
            </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assessment title" htmlFor="title">
              <Input
                id="title"
                placeholder={`${job.title} Assessment`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Related job" htmlFor="job">
              <JobSelect
                id="job"
                value={jobId}
                currentJob={job}
                onChange={(nextId, nextJob) => onJobChange(nextId, nextJob)}
              />
            </Field>
            <Field label="Difficulty" htmlFor="difficulty">
              <select
                id="difficulty"
                className={nativeSelectClass}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              >
                {difficulties.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Number of questions" htmlFor="count">
              <Input
                id="count"
                type="number"
                min={1}
                max={12}
                value={questionCount}
                onChange={(e) => setQuestionCount(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Question types</p>
            <div className="flex flex-wrap gap-2">
              {allTypes.map((t) => {
                const on = questionTypes.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {questionTypeLabels[t]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Skills / topics to evaluate</p>
            <div className="flex flex-wrap gap-2">
              {job.requiredSkills.map((skill) => {
                const on = topics.includes(skill)
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleTopic(skill)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {skill}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Button onClick={generate} disabled={working}>
              {working ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> {draft ? "Regenerate questions" : "Generate questions"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {draft && (
        <>
          {fallback && (
            <Notice>
              <span className="text-muted-foreground">
                The AI agent was unavailable, so these are template questions generated directly from the job&apos;s required
                skills. You can edit them before publishing.
              </span>
            </Notice>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Review &amp; edit ({draft.length})</h2>
              <p className="text-sm text-muted-foreground">
                The AI draft is not final — edit, delete or regenerate before publishing.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={generate} disabled={working}>
                <RefreshCw className="size-4" /> Regenerate
              </Button>
              <Button onClick={publish} disabled={draft.length === 0}>
                Publish <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {draft.map((q, i) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={i}
                onChange={updateQuestion}
                onDelete={() => removeQuestion(q.id)}
              />
            ))}
          </div>
        </>
      )}
      </>
    )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4" /> Published assessments
          </CardTitle>
          <CardDescription>Assessments candidates can currently take.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {assessments.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No assessments yet. Configure one above to get started.</p>
          ) : (
            assessments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.jobTitle} · {a.company} · {a.questions.length} questions · {a.difficulty}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.status === "published" ? "default" : "secondary"}>{a.status}</Badge>
                  <Button variant="outline" size="icon-sm" onClick={() => deleteAssessment(a.id)} aria-label={`Delete ${a.title}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  )
}
