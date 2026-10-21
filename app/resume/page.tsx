"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  UploadCloud,
  FileCheck2,
  AlertCircle,
  GraduationCap,
  Briefcase,
  Code2,
  FolderGit2,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { Notice, PageHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function ResumePage() {
  const { resumeUploaded, resumeFileName, profile, uploadResume } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [justUploaded, setJustUploaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleParse() {
    if (!pendingFile) return
    setParsing(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", pendingFile)
      const res = await fetch("/api/resume", { method: "POST", body: formData })
      const data = await res.json()

      if (!data.ok) {
        if (data.reason === "no_text") {
          setError("No readable text was detected even with AI OCR. Please ensure the document is clear and not password-protected.")
        } else if (data.reason === "too_large") {
          setError("The file exceeds the 10 MB limit. Please upload a smaller file.")
        } else {
          setError("We couldn't parse this resume file. Please verify the file format and try again.")
        }
        return
      }

      uploadResume(pendingFile.name, data.profile)
      setPendingFile(null)
      setJustUploaded(true)
    } catch {
      setError("An unexpected error occurred during extraction. Please try again.")
    } finally {
      setParsing(false)
    }
  }

  const showExtraction = resumeUploaded && !pendingFile

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-300">
      <PageHeader
        title="Resume Analyzer & AI OCR"
        description="Upload your resume in PDF or Word format. Our multi-engine pipeline extracts structured candidate evidence, work history, and technical competencies."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs py-1 gap-1.5 hidden sm:inline-flex">
              <Sparkles className="size-3" /> Multimodal AI OCR Active
            </Badge>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/profile" />} className="text-xs gap-1.5">
              View Profile <ArrowRight className="size-3.5" />
            </Button>
          </div>
        }
      />

      {/* Stepper info card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/[0.03] via-card to-card">
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileCheck2 className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Next-Gen Document Intelligence</p>
              <p className="text-xs text-muted-foreground">
                Equipped with native OCR fallback for scanned PDFs, Canva templates, LaTeX files, and Microsoft Word DOCX.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-medium text-muted-foreground">Supported Formats:</span>
            <Badge variant="secondary" className="text-[11px]">.PDF (Scanned/Digital)</Badge>
            <Badge variant="secondary" className="text-[11px]">.DOCX</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Upload Column */}
        <Card className="lg:col-span-2 flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Upload Document</CardTitle>
            <CardDescription className="text-xs">
              PDF or DOCX file, up to 10 MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 flex-1 justify-between">
            <div className="flex flex-col gap-3">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setPendingFile(file)
                    setJustUploaded(false)
                    setError(null)
                  }
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "group flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 cursor-pointer",
                  pendingFile
                    ? "border-primary/60 bg-primary/[0.04]"
                    : "border-border/80 hover:border-primary/50 hover:bg-muted/30"
                )}
              >
                <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground group-hover:scale-105 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-200">
                  <UploadCloud className="size-6" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors block">
                    {pendingFile ? "Change Selected File" : "Choose Your Resume"}
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5 block">
                    Click to browse or drop file here
                  </span>
                </div>
              </button>

              {pendingFile && (
                <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/[0.02] p-3 text-sm animate-in fade-in-50 duration-200">
                  <FileText className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{pendingFile.name}</p>
                    <p className="text-[11px] text-muted-foreground">{Math.max(1, Math.round(pendingFile.size / 1024))} KB</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] py-0 border-primary/30 text-primary">
                    Ready
                  </Badge>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{error}</p>
                </div>
              )}

              {resumeUploaded && !pendingFile && !error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-xs">Resume Extracted &amp; Profile Active</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {resumeFileName || "Document"} {justUploaded ? "· analyzed just now" : "· on file"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleParse}
              disabled={!pendingFile || parsing}
              className="w-full gap-2 transition-all"
            >
              {parsing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Extracting with AI OCR…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Upload &amp; Analyze Resume
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Extracted Profile Preview Column */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Structured Profile Evidence</CardTitle>
              <CardDescription className="text-xs">
                Parsed from your document. This evidence grounds AI job matches and interviews.
              </CardDescription>
            </div>
            {showExtraction && (
              <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/profile" />} className="text-xs gap-1">
                Edit Profile <ArrowRight className="size-3" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!showExtraction ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center border border-dashed rounded-xl bg-muted/10">
                <FileText className="size-8 text-muted-foreground/60" />
                <p className="text-xs font-semibold text-foreground">No Document Analyzed Yet</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Upload your PDF or Word resume on the left to view parsed contact details, experience, skills, and education.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 animate-in fade-in-50 duration-300">
                {/* Header Information */}
                <div className="flex flex-col gap-1 rounded-lg bg-muted/30 p-3 border border-border/60">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground">{profile.name || "Candidate Name"}</p>
                    {profile.location && (
                      <Badge variant="outline" className="text-[10px] py-0">
                        {profile.location}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-primary font-medium">{profile.title || "Professional Headline"}</p>
                  {(profile.email || profile.phone) && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {[profile.email, profile.phone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {profile.summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1 pt-1 border-t border-border/40">
                      {profile.summary}
                    </p>
                  )}
                </div>

                {/* Technical Skills */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Code2 className="size-3.5 text-primary" />
                    <span>Extracted Skills ({profile.skills.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs py-0.5 px-2">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Experience */}
                {profile.experience.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Briefcase className="size-3.5 text-primary" />
                      <span>Work History ({profile.experience.length})</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {profile.experience.map((x, idx) => (
                        <div key={idx} className="flex flex-col gap-0.5 rounded-md border border-border/60 p-2.5 bg-card">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground">{x.title}</span>
                            <span className="text-[11px] text-muted-foreground">{x.years}</span>
                          </div>
                          <p className="text-[11px] text-primary">{x.company}</p>
                          {x.highlights && x.highlights.length > 0 && (
                            <ul className="list-disc pl-4 text-[11px] text-muted-foreground mt-1 space-y-0.5">
                              {x.highlights.slice(0, 2).map((h, hIdx) => (
                                <li key={hIdx}>{h}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education */}
                {profile.education.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <GraduationCap className="size-3.5 text-primary" />
                      <span>Education ({profile.education.length})</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {profile.education.map((e, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs rounded-md border border-border/60 p-2 bg-card">
                          <div>
                            <span className="font-semibold text-foreground">{e.degree}</span>
                            <span className="text-muted-foreground text-[11px]"> · {e.institution}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{e.years}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Notice tone="info">
                    Every AI agent (matching, tailoring, interview prep) uses this extracted evidence.
                  </Notice>
                  <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/profile" />} className="shrink-0 ml-3 text-xs gap-1">
                    Edit Profile <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
