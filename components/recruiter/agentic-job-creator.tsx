"use client"

import { useState } from "react"
import {
  Sparkles,
  Briefcase,
  CheckCircle2,
  Loader2,
  Building2,
  MapPin,
  Clock,
  DollarSign,
  ArrowRight,
  Eye,
  FileText,
  HelpCircle,
  RefreshCw,
  Send,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { GeneratedJobDraft } from "@/lib/jobs/agentic-jd"

const PROMPT_PRESETS = [
  "Senior Full Stack Engineer (React, Node.js, Postgres) at TechCorp in Bangalore, 4+ yrs experience, ₹18-25 LPA. Building real-time SaaS APIs and high-scale frontends.",
  "Lead DevOps & Cloud Engineer (AWS, Kubernetes, Terraform) at CloudScale Remote/Hyderabad, 5+ yrs experience, ₹24-32 LPA. Designing zero-downtime CI/CD and infra security.",
  "AI & Python Engineer (FastAPI, PyTorch, LLM agents) at NeuralLabs Pune/Hybrid, 2-4 yrs experience, ₹16-22 LPA. Developing production AI pipelines and RAG workflows.",
]

export function AgenticJobCreator({ onJobPublished }: { onJobPublished?: (result: any, draft?: GeneratedJobDraft) => void }) {
  const [prompt, setPrompt] = useState("")
  const [company, setCompany] = useState("")
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [draft, setDraft] = useState<GeneratedJobDraft | null>(null)
  const [publishedJobId, setPublishedJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setDraft(null)
    setPublishedJobId(null)

    try {
      const res = await fetch("/api/recruiter/generate-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          company: company.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to generate job description")
      }

      const data = await res.json()
      setDraft(data.draft)
    } catch (err: any) {
      setError(err.message || "Something went wrong generating the job.")
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!draft) return
    setPublishing(true)
    setError(null)

    try {
      const res = await fetch("/api/recruiter/publish-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to publish job")
      }

      const data = await res.json()
      setPublishedJobId(data.jobId)
      onJobPublished?.(data, draft)
    } catch (err: any) {
      setError(err.message || "Failed to publish job to portal.")
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-b from-card to-primary/[0.02]">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Agentic Job Creator</CardTitle>
              <CardDescription>
                Describe what role you need to hire. The AI Agent writes the full Job Description, fills all requirements, and prepares tailored interview criteria.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-primary border-primary/30">
            <Zap className="size-3 mr-1" /> Autonomous Agent
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Prompt Input */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor="agent-prompt" className="text-sm font-medium">
              Describe the role or paste raw requirements:
            </Label>
            <div className="flex items-center gap-1.5">
              <Building2 className="size-3.5 text-muted-foreground" />
              <Input
                id="agent-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company Name (optional)"
                className="h-7 text-xs w-48"
                disabled={loading || publishing}
              />
            </div>
          </div>
          <div className="relative">
            <Textarea
              id="agent-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. We need a Senior Full Stack Developer at Acme Corp in Hyderabad with 4+ years React, Node.js, and Postgres. Salary 18-24 LPA. Responsibilities include building scalable APIs and leading feature squads..."
              className="resize-y pr-28 text-sm"
              disabled={loading || publishing}
            />
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={loading || publishing || !prompt.trim()}
              className="absolute right-2.5 bottom-2.5"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" /> Drafting…
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5 mr-1.5" /> Generate JD
                </>
              )}
            </Button>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-muted-foreground mr-1">Quick ideas:</span>
            {PROMPT_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(p)}
                className="rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors truncate max-w-[260px]"
              >
                {p.split(" in ")[0] || p.slice(0, 30)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Loading state indicator */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="relative flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-pulse">
              <Sparkles className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">AI Agent is crafting the Job Description…</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Extracting technical skills, salary benchmarks, responsibilities, and interview screening questions.
              </p>
            </div>
          </div>
        )}

        {/* Generated Draft Review & Confirmation Form */}
        {draft && !publishedJobId && (
          <div className="flex flex-col gap-5 rounded-xl border border-primary/30 bg-card p-4 sm:p-5 animate-in fade-in zoom-in-95">
            <div className="flex flex-col gap-1 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/40 text-xs">
                    Draft Prepared by AI Agent
                  </Badge>
                  <span className="text-xs text-muted-foreground">Ready for your review</span>
                </div>
                <h3 className="text-base font-semibold mt-1">Review &amp; Approve Job Description</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                You can edit any field before publishing.
              </p>
            </div>

            {/* Editable Fields Grid */}
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Job Title</Label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="h-8 text-xs font-medium"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Company Name</Label>
                <Input
                  value={draft.company}
                  onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                  className="h-8 text-xs font-medium"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Location &amp; Work Mode</Label>
                <Input
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                  className="h-8 text-xs font-medium"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Experience Required</Label>
                <Input
                  value={draft.experience}
                  onChange={(e) => setDraft({ ...draft, experience: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Salary / CTC</Label>
                <Input
                  value={draft.salary}
                  onChange={(e) => setDraft({ ...draft, salary: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Employment Type</Label>
                <Input
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as any })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Required Skills Badges */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Identified Core Skills</Label>
              <div className="flex flex-wrap gap-1.5">
                {draft.requiredSkills.map((skill, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Markdown Description */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Full Job Description (Markdown)</Label>
              <Textarea
                rows={6}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="font-mono text-xs leading-relaxed"
              />
            </div>

            {/* Generated Screening Questions */}
            {draft.interviewQuestions && draft.interviewQuestions.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <HelpCircle className="size-3.5 text-primary" />
                    AI Screening Interview Criteria ({draft.interviewQuestions.length} Questions)
                  </span>
                  <Badge variant="outline" className="text-[10px]">Auto-Evaluated</Badge>
                </div>
                <div className="flex flex-col gap-2 divide-y divide-border/60">
                  {draft.interviewQuestions.map((q, i) => (
                    <div key={i} className="pt-2 first:pt-0 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-muted-foreground">Q{i + 1}.</span>
                        <span className="text-xs font-medium text-foreground">{q.question}</span>
                      </div>
                      <div className="flex items-center gap-2 pl-5 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{q.skill}</Badge>
                        <span>Key expectations: {q.keyPoints.join(", ")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ask Permission to Publish Banner */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 p-3.5">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-5 text-primary shrink-0" />
                <p className="text-xs text-foreground/90">
                  Ready to go live? Approving will publish this job immediately to the <strong>Candidate Portal</strong> and enable official AI interviews.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDraft(null)}
                  disabled={publishing}
                  className="h-8 text-xs"
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={handlePublish}
                  disabled={publishing}
                  className="h-8 text-xs font-semibold"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" /> Publishing…
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5 mr-1.5" /> Confirm &amp; Publish Job
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Successfully Published State */}
        {publishedJobId && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-success/40 bg-success/10 p-6 text-center animate-in fade-in">
            <div className="flex size-10 items-center justify-center rounded-full bg-success text-success-foreground">
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-success">
                Job &amp; AI Screening Interview Published Successfully!
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Candidates can now discover this role in the Candidate Portal, apply, and complete the official AI interview.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setDraft(null)
                  setPublishedJobId(null)
                  setPrompt("")
                }}
              >
                <RefreshCw className="size-3 mr-1.5" /> Create Another Job
              </Button>
              <Button
                size="sm"
                className="text-xs"
                nativeButton={false}
                render={<a href="/jobs" target="_blank" rel="noopener noreferrer" />}
              >
                <Eye className="size-3.5 mr-1.5" /> View in Candidate Portal <ArrowRight className="size-3 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
