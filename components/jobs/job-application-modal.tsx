"use client"

import { useState, useEffect } from "react"
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Send,
  Sparkles,
  Upload,
  User,
  Mail,
  Phone,
  Globe,
  Briefcase,
  X,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { type Job, type MatchResult, computeMatch, isRecruiterJob } from "@/lib/demo-data"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useSession } from "@/lib/auth-client"

interface JobApplicationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: Job
  onApplied?: () => void
}

export function JobApplicationModal({ open, onOpenChange, job, onApplied }: JobApplicationModalProps) {
  const { data: session } = useSession()
  const { profile, resumeFileName, resumeUploaded } = useApp()

  const defaultName = session?.user?.name || profile.name || ""
  const defaultEmail = session?.user?.email || profile.email || ""

  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [phone, setPhone] = useState(profile.phone || "")
  const [coverNote, setCoverNote] = useState("")
  const [portfolioUrl, setPortfolioUrl] = useState("")
  const [resumeMode, setResumeMode] = useState<"profile" | "custom">("profile")
  const [customResumeText, setCustomResumeText] = useState("")
  const [customFileName, setCustomFileName] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(session?.user?.name || profile.name || "")
      setEmail(session?.user?.email || profile.email || "")
      setPhone(profile.phone || "")
      setSubmitted(false)
      setError(null)
    }
  }, [open, profile, session])

  const match = computeMatch(profile, job)
  const isDirect = isRecruiterJob(job)

  if (!isDirect) {
    const externalUrl =
      job.url ||
      `https://www.google.com/search?q=${encodeURIComponent(`${job.company} ${job.title} careers apply`)}`
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Globe className="size-5 text-primary" /> External Market Listing
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {job.title} · {job.company}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4 text-center gap-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              This position is an external market opportunity shown for informational purposes. Direct in-platform applications are only accepted for roles published by recruiters on PrepSensei.
            </p>
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground w-full border border-border/50 text-left">
              <p className="font-semibold text-foreground">How to apply:</p>
              <p className="mt-1 text-[11px]">
                Click below to visit the official employer portal and apply directly. You can still practice an AI mock interview and check your skill gap here on PrepSensei!
              </p>
            </div>
            <div className="flex w-full gap-2 mt-2">
              <Button variant="outline" className="flex-1 text-xs" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                className="flex-1 gap-1.5 text-xs"
                nativeButton={false}
                render={<a href={externalUrl} target="_blank" rel="noopener noreferrer" />}
              >
                <ExternalLink className="size-3.5" /> Company Portal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setCustomFileName(file.name)
    setError(null)

    // Parse resume via resume API if needed, or read text
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/resume", {
        method: "POST",
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.rawText) {
          setCustomResumeText(data.rawText)
        }
      }
    } catch {
      // Fallback: read text directly
      const text = await file.text().catch(() => "")
      setCustomResumeText(text)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const resumeToSubmit =
      resumeMode === "profile"
        ? (profile.summary + " " + (profile.skills || []).join(", ") + " " + (profile.experience || []).map((x) => x.highlights?.join(" ")).join(" "))
        : customResumeText

    const fileNameToSubmit =
      resumeMode === "profile"
        ? (resumeFileName || "profile_resume.pdf")
        : (customFileName || "custom_resume.pdf")

    try {
      const res = await fetch("/api/jobs/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          candidateName: name.trim(),
          candidateEmail: email.trim(),
          phone: phone.trim(),
          coverNote: coverNote.trim(),
          portfolioUrl: portfolioUrl.trim(),
          resumeText: resumeToSubmit,
          resumeFileName: fileNameToSubmit,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to submit application")
      }

      setSubmitted(true)
      if (onApplied) onApplied()
    } catch (err: any) {
      setError(err.message || "Failed to submit application. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-4">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[11px] gap-1">
              <Sparkles className="size-3" /> {match.score}% Alignment Match
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold mt-1">Apply for {job.title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {job.company} · {job.location} · {job.type} · {job.experience}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Application Received!</h3>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              Your resume and application details for <strong className="text-foreground">{job.title}</strong> have been submitted to <strong className="text-foreground">{job.company}</strong>.
            </p>
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground w-full max-w-sm mt-2 border border-border/50">
              <p className="font-medium text-foreground">What happens next?</p>
              <p className="mt-1 text-[11px]">
                The hiring team will run AI RAG shortlisting. If your profile is shortlisted or advanced to the interview round, you will receive an announcement in your candidate notifications and email.
              </p>
            </div>
            <Button className="mt-4 w-full max-w-xs" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            {error && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="app-name" className="text-xs flex items-center gap-1">
                  <User className="size-3 text-muted-foreground" /> Full Name
                </Label>
                <Input
                  id="app-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="app-email" className="text-xs flex items-center gap-1">
                  <Mail className="size-3 text-muted-foreground" /> Email Address
                </Label>
                <Input
                  id="app-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="app-phone" className="text-xs flex items-center gap-1">
                  <Phone className="size-3 text-muted-foreground" /> Phone Number
                </Label>
                <Input
                  id="app-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="app-portfolio" className="text-xs flex items-center gap-1">
                  <Globe className="size-3 text-muted-foreground" /> Portfolio / GitHub / LinkedIn
                </Label>
                <Input
                  id="app-portfolio"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://github.com/username"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Resume Selection */}
            <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="size-3.5 text-primary" /> Candidate Resume
              </Label>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="resumeMode"
                    value="profile"
                    checked={resumeMode === "profile"}
                    onChange={() => setResumeMode("profile")}
                    className="accent-primary"
                  />
                  <span>Use profile resume ({resumeFileName || "Analyzed Resume"})</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="resumeMode"
                    value="custom"
                    checked={resumeMode === "custom"}
                    onChange={() => setResumeMode("custom")}
                    className="accent-primary"
                  />
                  <span>Upload custom resume</span>
                </label>
              </div>

              {resumeMode === "custom" && (
                <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 cursor-pointer">
                      <Upload className="size-3.5" />
                      <span>{customFileName ? customFileName : "Choose PDF / DOCX file"}</span>
                      <input type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                  <Textarea
                    value={customResumeText}
                    onChange={(e) => setCustomResumeText(e.target.value)}
                    placeholder="Or paste your resume text here directly..."
                    className="h-20 text-xs font-mono"
                  />
                </div>
              )}
            </div>

            {/* Cover Note */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="app-note" className="text-xs">
                Brief Cover Note <span className="text-muted-foreground font-normal">(Why are you a standout match?)</span>
              </Label>
              <Textarea
                id="app-note"
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                placeholder="Highlight your relevant experience, top achievements, and why you are excited for this role..."
                className="h-20 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading} className="gap-1.5">
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                {loading ? "Submitting Application…" : "Submit Application"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
