"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, ShieldCheck, Wand2, XCircle } from "lucide-react"
import { useApp } from "@/lib/store"
import { computeMatch, demoJobs, type TruthClaimStatus } from "@/lib/demo-data"
import { JobSelect } from "@/components/job-select"
import { Field, Notice, PageHeader, Pipeline, nativeSelectClass } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const tailorSteps = [
  { label: "Original Candidate Evidence", description: "Your parsed resume and profile" },
  { label: "CV Tailoring Agent", description: "Re-orders and rephrases — never invents" },
  { label: "Tailored CV", description: "Focused on the target job" },
]

const statusMeta: Record<TruthClaimStatus, { Icon: typeof CheckCircle2; cls: string; label: string }> = {
  supported: { Icon: CheckCircle2, cls: "text-success", label: "Supported by candidate evidence" },
  needs_review: { Icon: AlertTriangle, cls: "text-warning", label: "Requires review" },
  unsupported: { Icon: XCircle, cls: "text-destructive", label: "Not found in candidate evidence" },
}

export default function CvTailorPage() {
  const { profile, selectedJobId, selectedJob, selectJob, tailoredJobId, tailoredCv, markTailored, truthCheckRun, truthCheck, runTruthCheck, allJobs } =
    useApp()
  const availableJobs = allJobs && allJobs.length > 0 ? allJobs : demoJobs
  // Prefer the actual selected Job object so the tailoring agent receives it.
  const job = selectedJob ?? availableJobs.find((j) => j.id === selectedJobId) ?? availableJobs[0] ?? null
  const match = job ? computeMatch(profile, job) : null
  const tailored = job !== null && tailoredJobId === job.id && tailoredCv !== null
  const [working, setWorking] = useState<"tailor" | "check" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)

  async function tailor() {
    if (!job) return
    setWorking("tailor")
    setError(null)
    try {
      const res = await fetch("/api/cv-tailor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "tailor", job, profile }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      markTailored(job.id, data.cv)
      setFallback(Boolean(data.fallback))
    } catch {
      setError("CV tailoring is unavailable right now. Please try again in a moment.")
    } finally {
      setWorking(null)
    }
  }

  async function check() {
    if (!tailoredCv) return
    setWorking("check")
    setError(null)
    try {
      const res = await fetch("/api/cv-tailor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "check", profile, cv: tailoredCv }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      runTruthCheck(data.check)
      setFallback(Boolean(data.fallback))
    } catch {
      setError("The truthfulness check is unavailable right now. Please try again in a moment.")
    } finally {
      setWorking(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-300">
      <PageHeader
        title="CV Tailor"
        description="Generate a version of your CV focused on a target role, grounded strictly in your existing evidence."
        actions={
          <Field label="Target job" htmlFor="job">
            <JobSelect
              id="job"
              value={job?.id ?? ""}
              currentJob={job}
              onChange={(nextId, nextJob) => {
                selectJob(nextId, nextJob)
              }}
            />
          </Field>
        }
      />

      <Card>
        <CardContent>
          <Pipeline steps={tailorSteps} activeIndex={tailored ? 2 : 0} />
        </CardContent>
      </Card>

      <Notice>
        <span className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <strong>PrepSensei only uses information supported by your original resume.</strong> It will not add jobs, skills,
            certifications, projects or achievements that are not in your evidence.
          </span>
        </span>
      </Notice>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!job ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Wand2 className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Select a job before tailoring your CV.</p>
            <p className="max-w-md text-sm text-muted-foreground text-pretty">
              Choose a target role from the job search or matches, then return here to tailor your CV for it.
            </p>
          </CardContent>
        </Card>
      ) : !tailored ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Wand2 className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              Tailor your CV for {job.title} at {job.company}
            </p>
            <p className="max-w-md text-sm text-muted-foreground text-pretty">
              {match && match.matching.length > 0
                ? `The agent will emphasise your ${match.matching.slice(0, 3).join(", ")} experience and rewrite your summary for this role.`
                : "The agent will rewrite your summary and reorder your evidence for this role."}
            </p>
            <Button onClick={tailor} disabled={working === "tailor"}>
              {working === "tailor" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Tailoring…
                </>
              ) : (
                <>
                  <Wand2 className="size-4" /> Generate tailored CV
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {fallback && (
            <Notice>
              <span className="text-muted-foreground">
                The AI assistant was unavailable, so this is an evidence-based draft generated directly from your profile.
              </span>
            </Notice>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Professional summary</CardTitle>
                <CardDescription>Rewritten for {job.title}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-pretty">{tailoredCv.summary}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Relevant skills</CardTitle>
                <CardDescription>Ordered by relevance to the job requirements</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {tailoredCv.skills.map((s) => (
                  <Badge key={s} variant={match?.matching.includes(s) ? "default" : "secondary"}>
                    {s}
                  </Badge>
                ))}
              </CardContent>
            </Card>

            {tailoredCv.experienceImprovements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Experience improvements</CardTitle>
                  <CardDescription>Same facts, sharper wording</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 text-sm">
                  {tailoredCv.experienceImprovements.map((d, i) => (
                    <Diff key={i} before={d.before} after={d.after} />
                  ))}
                </CardContent>
              </Card>
            )}

            {tailoredCv.suggestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Suggested changes</CardTitle>
                  <CardDescription>Actions for you to review</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2 text-sm">
                    {tailoredCv.suggestions.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-4" /> Truthfulness Check
                </CardTitle>
                <CardDescription>
                  Compares each claim in the tailored CV against your original candidate evidence. This is evidence-checking, not a
                  guaranteed fact detector.
                </CardDescription>
              </div>
              {!truthCheckRun && (
                <Button variant="outline" onClick={check} disabled={working === "check"}>
                  {working === "check" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Checking…
                    </>
                  ) : (
                    "Run check"
                  )}
                </Button>
              )}
            </CardHeader>
            {truthCheckRun && truthCheck && (
              <CardContent className="flex flex-col gap-4">
                <ul className="flex flex-col divide-y divide-border">
                  {truthCheck.claims.map((c, i) => {
                    const meta = statusMeta[c.status]
                    return (
                      <li key={i} className="flex items-start gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                        <meta.Icon className={`mt-0.5 size-4 shrink-0 ${meta.cls}`} />
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {c.claim} — {meta.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{c.explanation}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <OverallBanner status={truthCheck.overall} />
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function OverallBanner({ status }: { status: TruthClaimStatus }) {
  const copy: Record<TruthClaimStatus, { title: string; note: string; tone: string }> = {
    supported: {
      title: "Final status: Supported",
      note: "Every checked claim is backed by your original evidence.",
      tone: "border-success/40 bg-success/10",
    },
    needs_review: {
      title: "Final status: Review recommended",
      note: "One or more claims could not be matched exactly to your evidence. This does not mean they are false — please confirm them before applying.",
      tone: "border-warning/40 bg-warning/10",
    },
    unsupported: {
      title: "Final status: Unsupported claims found",
      note: "One or more claims were not found in your evidence. Remove or substantiate them before applying.",
      tone: "border-destructive/40 bg-destructive/10",
    },
  }
  const c = copy[status]
  return (
    <div className={`flex flex-col gap-3 rounded-md border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${c.tone}`}>
      <div>
        <p className="font-medium">{c.title}</p>
        <p className="text-xs text-muted-foreground">{c.note}</p>
      </div>
      <Button nativeButton={false} render={<Link href="/interview" />}>
        Practice interview <ArrowRight className="size-4" />
      </Button>
    </div>
  )
}

function Diff({ before, after }: { before: string; after: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground">
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide">Before</span>
        {before}
      </p>
      <p>
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-primary">After</span>
        {after}
      </p>
    </div>
  )
}
