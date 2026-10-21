"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  AlertCircle,
  Briefcase,
  Building2,
  CheckCircle2,
  Code2,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react"
import { useApp } from "@/lib/store"
import type { CandidateProfile, Education, Experience, Project } from "@/lib/demo-data"
import { Field, PageHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export default function ProfilePage() {
  const { profile, profileLoading, resumeUploaded, resumeFileName, updateProfile } = useApp()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<CandidateProfile>(profile)
  const [newSkill, setNewSkill] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // In-line addition states for project tech tags and experience highlights
  const [newProjectTech, setNewProjectTech] = useState<Record<number, string>>({})
  const [newHighlight, setNewHighlight] = useState<Record<number, string>>({})

  // Face biometrics status
  const [faceStatus, setFaceStatus] = useState<{
    registered: boolean
    registeredAt?: string | null
    livenessVerified?: boolean
    photos?: { front?: string; left?: string; right?: string } | null
  } | null>(null)
  const [faceLoading, setFaceLoading] = useState(true)

  // Keep draft in sync when profile loads from server
  useEffect(() => {
    if (!editing) {
      setDraft(JSON.parse(JSON.stringify(profile)))
    }
  }, [profile, editing])

  // Fetch biometric face registration status
  useEffect(() => {
    let cancelled = false
    async function checkFaceStatus() {
      try {
        const res = await fetch("/api/face", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status" }),
        })
        const data = await res.json()
        if (!cancelled) {
          setFaceStatus(data)
          setFaceLoading(false)
        }
      } catch {
        if (!cancelled) {
          setFaceStatus({ registered: false })
          setFaceLoading(false)
        }
      }
    }
    checkFaceStatus()
    return () => {
      cancelled = true
    }
  }, [])

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(profile)))
    setEditing(true)
    setSaveSuccess(false)
    setSaveError(null)
  }

  function handleCancel() {
    setDraft(JSON.parse(JSON.stringify(profile)))
    setEditing(false)
    setSaveError(null)
  }

  async function handleSave() {
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const ok = await updateProfile(draft)
      if (ok) {
        setEditing(false)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 5000)
      } else {
        setSaveError("Failed to save profile changes. Please try again.")
      }
    } catch {
      setSaveError("An unexpected error occurred while saving your profile.")
    } finally {
      setIsSaving(false)
    }
  }

  // Skills
  function addSkill() {
    const s = newSkill.trim()
    if (!s) return
    const exists = draft.skills.some((k) => k.toLowerCase() === s.toLowerCase())
    if (exists) return
    setDraft({ ...draft, skills: [...draft.skills, s] })
    setNewSkill("")
  }

  function removeSkill(s: string) {
    setDraft({ ...draft, skills: draft.skills.filter((k) => k !== s) })
  }

  // Education
  function addEducation() {
    const newEdu: Education = { degree: "", institution: "", years: "" }
    setDraft({ ...draft, education: [...draft.education, newEdu] })
  }

  function removeEducation(index: number) {
    setDraft({ ...draft, education: draft.education.filter((_, i) => i !== index) })
  }

  function updateEducation(index: number, patch: Partial<Education>) {
    setDraft({
      ...draft,
      education: draft.education.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    })
  }

  // Projects
  function addProject() {
    const newProj: Project = { name: "", description: "", tech: [] }
    setDraft({ ...draft, projects: [...draft.projects, newProj] })
  }

  function removeProject(index: number) {
    setDraft({ ...draft, projects: draft.projects.filter((_, i) => i !== index) })
  }

  function updateProject(index: number, patch: Partial<Project>) {
    setDraft({
      ...draft,
      projects: draft.projects.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    })
  }

  function addProjectTechTag(projIndex: number) {
    const val = (newProjectTech[projIndex] || "").trim()
    if (!val) return
    const current = draft.projects[projIndex]?.tech || []
    if (current.some((t) => t.toLowerCase() === val.toLowerCase())) return
    updateProject(projIndex, { tech: [...current, val] })
    setNewProjectTech((prev) => ({ ...prev, [projIndex]: "" }))
  }

  function removeProjectTechTag(projIndex: number, tag: string) {
    const current = draft.projects[projIndex]?.tech || []
    updateProject(projIndex, { tech: current.filter((t) => t !== tag) })
  }

  // Experience
  function addExperience() {
    const newExp: Experience = { title: "", company: "", years: "", highlights: [] }
    setDraft({ ...draft, experience: [...draft.experience, newExp] })
  }

  function removeExperience(index: number) {
    setDraft({ ...draft, experience: draft.experience.filter((_, i) => i !== index) })
  }

  function updateExperience(index: number, patch: Partial<Experience>) {
    setDraft({
      ...draft,
      experience: draft.experience.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    })
  }

  function addHighlight(expIndex: number) {
    const text = (newHighlight[expIndex] || "").trim()
    if (!text) return
    const current = draft.experience[expIndex]?.highlights || []
    updateExperience(expIndex, { highlights: [...current, text] })
    setNewHighlight((prev) => ({ ...prev, [expIndex]: "" }))
  }

  function updateHighlight(expIndex: number, hlIndex: number, text: string) {
    const current = [...(draft.experience[expIndex]?.highlights || [])]
    current[hlIndex] = text
    updateExperience(expIndex, { highlights: current })
  }

  function removeHighlight(expIndex: number, hlIndex: number) {
    const current = (draft.experience[expIndex]?.highlights || []).filter((_, i) => i !== hlIndex)
    updateExperience(expIndex, { highlights: current })
  }

  const view = editing ? draft : profile
  const isEmpty = !resumeUploaded && !profile.name && profile.skills.length === 0

  if (profileLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading profile" />
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Candidate Profile"
        description="Your verified identity, skills, and background. Every AI agent, evaluator, and study roadmap operates from this ground truth."
        actions={
          editing ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {isSaving ? "Saving changes…" : "Save changes"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={startEdit} className="gap-2">
              <Pencil className="size-4" /> Edit profile
            </Button>
          )
        }
      />

      {/* Status Alerts */}
      {isEmpty && !editing && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <UploadCloud className="size-5 shrink-0 text-primary" />
          <span className="flex-1 text-pretty text-foreground">
            Your profile has no resume data yet. Upload your resume to extract skills, experience, and projects automatically, or fill it out manually.
          </span>
          <Button size="sm" variant="default" nativeButton={false} render={<Link href="/resume" />}>
            Upload Resume
          </Button>
        </div>
      )}

      {saveSuccess && !editing && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
          <span>Profile saved successfully! Job matching, AI skill gap analysis, and study plans will use your updated profile.</span>
        </div>
      )}

      {saveError && (
        <div className="flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Top Identity & Biometric Verification Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Biometric Face Verification Card */}
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ScanFace className="size-5 text-primary" />
                Biometric Face Identity
              </CardTitle>
              {faceLoading ? (
                <Badge variant="outline" className="text-xs">
                  <Loader2 className="size-3 animate-spin mr-1" /> Checking…
                </Badge>
              ) : faceStatus?.registered ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs font-semibold">
                  <ShieldCheck className="size-3.5" /> Biometrics Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs">
                  Registration Pending
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Vision verification protects your interview identity and ensures anti-cheating audit integrity.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {faceStatus?.registered ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  {faceStatus.photos?.front ? (
                    <img
                      src={faceStatus.photos.front}
                      alt="Verified Face"
                      className="size-12 rounded-lg object-cover border border-border shadow-xs"
                    />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ScanFace className="size-6" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">3-Angle Profile Active</span>
                    <span className="text-xs text-muted-foreground">
                      {faceStatus.registeredAt
                        ? `Registered on ${new Date(faceStatus.registeredAt).toLocaleDateString()}`
                        : "Liveness and multi-angle verified"}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/interview" />} className="text-xs">
                  Test Vision Gate
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Face biometrics not registered
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Required before taking verified AI mock interviews.
                  </span>
                </div>
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/interview" />} className="text-xs shrink-0">
                  Register Face
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resume & Document Status Card */}
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-5 text-primary" />
                Parsed Resume Source
              </CardTitle>
              {resumeUploaded ? (
                <Badge className="bg-primary/15 text-primary border-primary/30 text-xs font-semibold">
                  Active Document
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  No Resume Attached
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Candidate profile and skill matches are synchronized with this document.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="size-5 text-muted-foreground shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold truncate">
                    {resumeFileName || "No resume file uploaded"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {resumeUploaded
                      ? "Extracted with AI parser & OCR pipeline"
                      : "Upload a PDF or Word document"}
                  </span>
                </div>
              </div>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/resume" />} className="text-xs shrink-0">
                {resumeUploaded ? "Re-upload / Update" : "Upload File"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Basic Info & Summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {editing ? (
              <div className="flex flex-col gap-3">
                <Field label="Full Name" htmlFor="name">
                  <Input
                    id="name"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Gnandeep Padala"
                  />
                </Field>
                <Field label="Professional Title" htmlFor="title">
                  <Input
                    id="title"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="e.g. Senior Backend Engineer"
                  />
                </Field>
                <Field label="Email Address" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    placeholder="you@domain.com"
                  />
                </Field>
                <Field label="Phone" htmlFor="phone">
                  <Input
                    id="phone"
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                </Field>
                <Field label="Location" htmlFor="location">
                  <Input
                    id="location"
                    value={draft.location}
                    onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                    placeholder="City, State / Remote"
                  />
                </Field>
              </div>
            ) : (
              <dl className="flex flex-col gap-3.5 text-sm">
                <div className="flex items-start gap-2.5">
                  <span className="text-xs font-medium uppercase text-muted-foreground w-20 shrink-0 pt-0.5">Name</span>
                  <span className="font-semibold text-foreground">{view.name || "—"}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-xs font-medium uppercase text-muted-foreground w-20 shrink-0 pt-0.5">Title</span>
                  <span className="font-medium text-foreground">{view.title || "—"}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-xs font-medium uppercase text-muted-foreground w-20 shrink-0 pt-0.5">Email</span>
                  <span className="text-foreground flex items-center gap-1.5 break-all">
                    <Mail className="size-3.5 text-muted-foreground shrink-0" />
                    {view.email || "—"}
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-xs font-medium uppercase text-muted-foreground w-20 shrink-0 pt-0.5">Phone</span>
                  <span className="text-foreground flex items-center gap-1.5">
                    <Phone className="size-3.5 text-muted-foreground shrink-0" />
                    {view.phone || "—"}
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-xs font-medium uppercase text-muted-foreground w-20 shrink-0 pt-0.5">Location</span>
                  <span className="text-foreground flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                    {view.location || "—"}
                  </span>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-border/80">
          <CardHeader>
            <CardTitle className="text-base">Professional Summary</CardTitle>
            <CardDescription className="text-xs">
              A high-level synthesis of your experience, core architectural stack, and impact.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {editing ? (
              <Textarea
                rows={6}
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                placeholder="Write a brief overview of your background, specializations, and achievements..."
                className="leading-relaxed"
              />
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {view.summary || "No professional summary provided yet. Click 'Edit profile' to add one."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Verified Skills */}
      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="size-5 text-primary" />
                Verified Skills &amp; Technologies
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Matched against job description requirements to evaluate role fit and skill gaps.
              </CardDescription>
            </div>
            <Badge variant="outline" className="tabular-nums text-xs">
              {view.skills.length} skills
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3.5">
          <div className="flex flex-wrap gap-2">
            {view.skills.map((s) => (
              <Badge key={s} variant="secondary" className="h-7 text-xs font-medium gap-1.5 px-2.5 py-1">
                {s}
                {editing && (
                  <button
                    type="button"
                    aria-label={`Remove ${s}`}
                    onClick={() => removeSkill(s)}
                    className="rounded-full p-0.5 hover:bg-foreground/15 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </Badge>
            ))}
            {view.skills.length === 0 && !editing && (
              <p className="text-xs text-muted-foreground">No skills listed yet.</p>
            )}
          </div>

          {editing && (
            <div className="flex max-w-md items-center gap-2 pt-1 border-t border-border/50">
              <Input
                placeholder="Add skill (e.g. Docker, TypeScript, Redis)"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addSkill()
                  }
                }}
                className="text-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={addSkill} className="shrink-0 gap-1 text-xs">
                <Plus className="size-3.5" /> Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Experience Section */}
      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="size-5 text-primary" />
                Work Experience
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Roles, achievements, and technical scope across your career.
              </CardDescription>
            </div>
            {editing && (
              <Button type="button" size="sm" variant="outline" onClick={addExperience} className="gap-1.5 text-xs">
                <Plus className="size-3.5" /> Add Experience
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {view.experience.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
              No work experience listed yet. {editing && "Click 'Add Experience' above to add your first role."}
            </div>
          )}

          {view.experience.map((x, expIdx) => (
            <div key={expIdx} className="relative flex flex-col gap-3 rounded-lg border border-border/60 bg-card/60 p-4 shadow-2xs">
              {editing ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                      Experience #{expIdx + 1}
                    </span>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => removeExperience(expIdx)}
                      className="text-destructive hover:bg-destructive/10"
                      title="Remove experience"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <Field label="Job Title" htmlFor={`title-${expIdx}`}>
                      <Input
                        id={`title-${expIdx}`}
                        value={x.title}
                        onChange={(e) => updateExperience(expIdx, { title: e.target.value })}
                        placeholder="e.g. Senior Backend Engineer"
                        className="text-xs"
                      />
                    </Field>
                    <Field label="Company" htmlFor={`company-${expIdx}`}>
                      <Input
                        id={`company-${expIdx}`}
                        value={x.company}
                        onChange={(e) => updateExperience(expIdx, { company: e.target.value })}
                        placeholder="e.g. Google / Stripe"
                        className="text-xs"
                      />
                    </Field>
                    <Field label="Duration" htmlFor={`years-${expIdx}`}>
                      <Input
                        id={`years-${expIdx}`}
                        value={x.years}
                        onChange={(e) => updateExperience(expIdx, { years: e.target.value })}
                        placeholder="e.g. 2022 – Present"
                        className="text-xs"
                      />
                    </Field>
                  </div>

                  {/* Highlights Editor */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-border/50">
                    <span className="text-xs font-medium text-foreground">Bullet Points &amp; Achievements</span>
                    {x.highlights.map((hl, hlIdx) => (
                      <div key={hlIdx} className="flex items-center gap-2">
                        <Input
                          value={hl}
                          onChange={(e) => updateHighlight(expIdx, hlIdx, e.target.value)}
                          className="text-xs flex-1"
                        />
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => removeHighlight(expIdx, hlIdx)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ))}

                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        placeholder="Add achievement or responsibility bullet point..."
                        value={newHighlight[expIdx] || ""}
                        onChange={(e) => setNewHighlight({ ...newHighlight, [expIdx]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addHighlight(expIdx)
                          }
                        }}
                        className="text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addHighlight(expIdx)}
                        className="text-xs shrink-0 gap-1"
                      >
                        <Plus className="size-3" /> Add Bullet
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {x.title}{" "}
                      <span className="font-normal text-muted-foreground">· {x.company}</span>
                    </h3>
                    <span className="text-xs font-medium text-muted-foreground">{x.years}</span>
                  </div>
                  {x.highlights && x.highlights.length > 0 && (
                    <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs text-muted-foreground leading-relaxed">
                      {x.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Projects & Education Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Projects */}
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  Key Projects
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Open-source contributions, engineering applications, and architecture portfolios.
                </CardDescription>
              </div>
              {editing && (
                <Button type="button" size="sm" variant="outline" onClick={addProject} className="gap-1.5 text-xs">
                  <Plus className="size-3.5" /> Add Project
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {view.projects.length === 0 && (
              <div className="rounded-lg border border-dashed border-border/80 p-5 text-center text-xs text-muted-foreground">
                No projects listed. {editing && "Click 'Add Project' to showcase your portfolio."}
              </div>
            )}

            {view.projects.map((p, projIdx) => (
              <div key={projIdx} className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-card/60 p-3.5 shadow-2xs">
                {editing ? (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                        Project #{projIdx + 1}
                      </span>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => removeProject(projIdx)}
                        className="text-destructive hover:bg-destructive/10"
                        title="Remove project"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    <Field label="Project Name" htmlFor={`proj-name-${projIdx}`}>
                      <Input
                        id={`proj-name-${projIdx}`}
                        value={p.name}
                        onChange={(e) => updateProject(projIdx, { name: e.target.value })}
                        placeholder="e.g. Distributed Task Queue"
                        className="text-xs"
                      />
                    </Field>

                    <Field label="Description" htmlFor={`proj-desc-${projIdx}`}>
                      <Textarea
                        id={`proj-desc-${projIdx}`}
                        rows={2}
                        value={p.description}
                        onChange={(e) => updateProject(projIdx, { description: e.target.value })}
                        placeholder="What problem did it solve, technical highlights, scale..."
                        className="text-xs"
                      />
                    </Field>

                    {/* Tech tags editor */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">Tech Stack Tags</span>
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {p.tech.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[11px] gap-1 pr-1">
                            {t}
                            <button
                              type="button"
                              onClick={() => removeProjectTechTag(projIdx, t)}
                              className="rounded-full hover:bg-foreground/20 p-0.5"
                            >
                              <X className="size-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          placeholder="Add technology (e.g. Go, Redis)..."
                          value={newProjectTech[projIdx] || ""}
                          onChange={(e) => setNewProjectTech({ ...newProjectTech, [projIdx]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              addProjectTechTag(projIdx)
                            }
                          }}
                          className="text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addProjectTechTag(projIdx)}
                          className="text-xs shrink-0"
                        >
                          Add Tag
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm font-semibold text-foreground">{p.name || "Untitled Project"}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                    {p.tech && p.tech.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {p.tech.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] py-0 px-2">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Education */}
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="size-5 text-primary" />
                  Education &amp; Credentials
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Degrees, institutions, and graduation timelines.
                </CardDescription>
              </div>
              {editing && (
                <Button type="button" size="sm" variant="outline" onClick={addEducation} className="gap-1.5 text-xs">
                  <Plus className="size-3.5" /> Add Education
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {view.education.length === 0 && (
              <div className="rounded-lg border border-dashed border-border/80 p-5 text-center text-xs text-muted-foreground">
                No education listed. {editing && "Click 'Add Education' to record your degree."}
              </div>
            )}

            {view.education.map((e, eduIdx) => (
              <div key={eduIdx} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/60 p-3.5 shadow-2xs">
                {editing ? (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                        Degree #{eduIdx + 1}
                      </span>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => removeEducation(eduIdx)}
                        className="text-destructive hover:bg-destructive/10"
                        title="Remove education"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <Field label="Degree / Field of Study" htmlFor={`edu-deg-${eduIdx}`}>
                      <Input
                        id={`edu-deg-${eduIdx}`}
                        value={e.degree}
                        onChange={(ev) => updateEducation(eduIdx, { degree: ev.target.value })}
                        placeholder="e.g. B.S. in Computer Science"
                        className="text-xs"
                      />
                    </Field>
                    <Field label="Institution" htmlFor={`edu-inst-${eduIdx}`}>
                      <Input
                        id={`edu-inst-${eduIdx}`}
                        value={e.institution}
                        onChange={(ev) => updateEducation(eduIdx, { institution: ev.target.value })}
                        placeholder="e.g. University of California, Berkeley"
                        className="text-xs"
                      />
                    </Field>
                    <Field label="Years" htmlFor={`edu-years-${eduIdx}`}>
                      <Input
                        id={`edu-years-${eduIdx}`}
                        value={e.years}
                        onChange={(ev) => updateEducation(eduIdx, { years: ev.target.value })}
                        placeholder="e.g. 2019 – 2023"
                        className="text-xs"
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold text-foreground">{e.degree || "Degree"}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.institution} {e.years ? `· ${e.years}` : ""}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
