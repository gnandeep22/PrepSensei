"use client"

import React, { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import {
  Sparkles,
  Bot,
  Brain,
  ShieldCheck,
  Cpu,
  Database,
  ArrowRight,
  CheckCircle2,
  Lock,
  ScanFace,
  Volume2,
  Mic,
  Zap,
  Layers,
  FileCheck2,
  Users,
  Eye,
  AlertTriangle,
  Play,
} from "lucide-react"
import { PageHeader } from "@/components/shared"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type ArchitecturePillar = "agentic" | "biometrics" | "speech" | "evaluation"

export default function HowItWorksPage() {
  const [activePillar, setActivePillar] = useState<ArchitecturePillar>("agentic")

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in-50 duration-300">
      {/* Hero Showcase */}
      <section className="relative overflow-hidden rounded-3xl border border-white/50 dark:border-white/10 bg-gradient-to-b from-card/90 via-card/50 to-muted/20 p-6 sm:p-10 lg:p-12 shadow-sm">
        <div className="relative z-10 max-w-3xl flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary gap-1 px-2.5 py-1">
              <Sparkles className="size-3" />
              Agentic Intelligence &amp; Vision Telemetry
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">v2.4 Architecture</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground text-balance">
            How PrepSensei Powers Grounded, High-Integrity AI Interviews.
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-pretty">
            PrepSensei combines real-time computer vision proctoring, multi-turn conversational AI agents, and grounded evidence verification to benchmark talent with unmatched fidelity and zero bias.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/interview" />}
              className="gap-2 shadow-xs"
            >
              <Play className="size-4" /> Start Mock Interview
            </Button>
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<Link href="/jobs" />}
              className="gap-2"
            >
              Browse Roles <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Ambient background light orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary/15 blur-3xl dark:bg-primary/20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 right-1/4 size-80 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/15"
        />
      </section>

      {/* Interactive Architecture Pillars */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Interactive Technical Deep Dive</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Select a core subsystem below to inspect its live pipeline, data flow, and guarantees.
          </p>
        </div>

        {/* Pillar Switcher Tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { id: "agentic", label: "Agentic Loop", icon: Brain, desc: "Autonomous cognitive cycle" },
            { id: "biometrics", label: "Vision Proctoring", icon: ScanFace, desc: "Anti-impersonation HUD" },
            { id: "speech", label: "Speech & Audio", icon: Volume2, desc: "Sub-200ms neural STT/TTS" },
            { id: "evaluation", label: "Grounded Scoring", icon: FileCheck2, desc: "Zero-hallucination rubric" },
          ].map((item) => {
            const Icon = item.icon
            const active = activePillar === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActivePillar(item.id as ArchitecturePillar)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-200 active:scale-[0.98]",
                  active
                    ? "border-primary bg-primary/10 shadow-xs"
                    : "border-border/70 bg-card/60 hover:bg-card hover:border-border"
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex size-7 items-center justify-center rounded-lg text-xs font-semibold",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">{item.label}</span>
                </div>
                <span className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</span>
              </button>
            )
          })}
        </div>

        {/* Dynamic Pillar Content */}
        <div className="mt-2">
          <AnimatePresence mode="wait">
            {activePillar === "agentic" && (
              <motion.div
                key="agentic"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid gap-4 lg:grid-cols-12 items-stretch"
              >
                <Card className="lg:col-span-7">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">Step-by-step</Badge>
                      <CardTitle className="text-base">The Cognitive Reasoning Loop</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Every candidate response triggers an autonomous 4-stage evaluation cycle before the AI formulates the next tailored technical probe.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {[
                      { step: "01", title: "Speech Ingestion & Context Retrieval", text: "Audio transcribed with speaker diarization. RAG fetches role rubrics and candidate profile evidence." },
                      { step: "02", title: "Grounded Truthfulness Validation", text: "Claims are matched against the candidate's verified resume. Gaps and strengths are indexed in memory." },
                      { step: "03", title: "Dynamic Follow-up Synthesis", text: "If candidate answers shallowly, agent branches into architectural trade-offs; if proficient, escalates difficulty." },
                      { step: "04", title: "Neural Voice Delivery", text: "Streaming low-latency synthesis delivers realistic human interviewer cadence with natural turn-taking." },
                    ].map((s) => (
                      <div key={s.step} className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                        <span className="font-mono text-xs font-bold text-primary px-1.5 py-0.5 rounded-md bg-primary/10">
                          {s.step}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs font-semibold text-foreground">{s.title}</p>
                          <p className="text-[11px] text-muted-foreground leading-normal">{s.text}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-5 flex flex-col justify-between">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldCheck className="size-4 text-emerald-500" />
                      Guardrails &amp; Safety
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Deterministic constraints preventing AI hallucinations.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-xs text-muted-foreground">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex flex-col gap-1">
                      <span className="font-semibold text-foreground flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" /> No Invented Facts
                      </span>
                      <p className="text-[11px]">
                        The agent only assesses topics explicitly required by the target job description or present in candidate profile evidence.
                      </p>
                    </div>

                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex flex-col gap-1">
                      <span className="font-semibold text-foreground flex items-center gap-1.5 text-primary">
                        <CheckCircle2 className="size-3.5" /> Structured Rubrics
                      </span>
                      <p className="text-[11px]">
                        Scoring strictly maps to 5 standard dimensions: Technical Depth, Architecture Trade-offs, Communication Clarity, Integrity, and Problem Decomposition.
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/30 p-3 flex flex-col gap-1">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Lock className="size-3.5 text-muted-foreground" /> Candidate Privacy First
                      </span>
                      <p className="text-[11px]">
                        Responses are private to the candidate during practice, and only shared with recruiters upon official submission.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activePillar === "biometrics" && (
              <motion.div
                key="biometrics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid gap-4 lg:grid-cols-12 items-stretch"
              >
                <Card className="lg:col-span-7">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px]">Client-Side Vision</Badge>
                      <CardTitle className="text-base">Real-time Biometric Proctoring</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Runs 100% locally in browser memory via WebAssembly without streaming raw camera feeds to external cloud vendors.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {[
                      { title: "128-D Euclidean Face Embedding", desc: "Extracts facial feature vector during registration across 3 angles (front, left, right). Distance threshold <= 0.48 indicates confirmed identity." },
                      { title: "Continuous Anti-Impersonation Audit", desc: "Samples video frames every 1.5s during official interviews. If a proxy attendee steps in, telemetry flags an immediate identity mismatch." },
                      { title: "Multiple Attendee Room Detection", desc: "Counts simultaneous faces in frame. Prevents unauthorized coaching or secondary prompters in the room." },
                      { title: "Gaze Direction & Camera Drift Telemetry", desc: "Measures percentage of time candidate gazes toward the screen versus secondary monitors or written cheat sheets." },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                          ✓
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs font-semibold text-foreground">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground leading-normal">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-5 flex flex-col justify-between">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ScanFace className="size-4 text-primary" />
                      Sample Proctoring Telemetry
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Sample audit report produced for hiring recruiters.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs">
                      <span className="font-medium text-foreground">Identity Verified</span>
                      <Badge variant="default" className="bg-emerald-600 text-white text-[10px]">100% Match</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card text-xs">
                      <span className="font-medium text-foreground">Gaze Toward Screen</span>
                      <span className="font-semibold text-foreground">92%</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card text-xs">
                      <span className="font-medium text-foreground">Multiple Faces Flagged</span>
                      <span className="font-semibold text-emerald-500">0 (Clean)</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card text-xs">
                      <span className="font-medium text-foreground">Active Camera Frame Rate</span>
                      <span className="font-semibold text-foreground">30 FPS (WebCam)</span>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3 mt-1">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        <strong>Privacy Safeguard:</strong> Biometric vectors are irreversible 128-float mathematical hashes. PrepSensei does not store raw biometric training files or sell candidate data.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activePillar === "speech" && (
              <motion.div
                key="speech"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid gap-4 lg:grid-cols-2"
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Mic className="size-4 text-primary" />
                      Speech-to-Text (STT) Recognition
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Instant audio streaming with continuous voice transcription.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-xs text-muted-foreground">
                    <p className="leading-relaxed">
                      Uses browser Web Speech API with fallback server Whisper endpoints. Handles domain-specific jargon such as Kubernetes, Redis, sharding, polymorphism, and asymptotic complexity without transcription dropouts.
                    </p>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex flex-col gap-1">
                      <span className="font-semibold text-foreground">Real-Time Word Stream:</span>
                      <p className="font-mono text-[11px] text-foreground/80 bg-background/80 p-2 rounded-lg border border-border/50">
                        &quot;...in terms of distributed caching, we opted for Redis Cluster with consistent hashing to prevent cache stampedes...&quot;
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Volume2 className="size-4 text-emerald-500" />
                      Neural Text-to-Speech (TTS)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Natural, authoritative interviewer voice synthesis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-xs text-muted-foreground">
                    <p className="leading-relaxed">
                      Questions are vocalized using fluid neural voices with adaptive pausing, inflection, and cadence designed to reduce candidate anxiety and replicate a comfortable executive interviewer tone.
                    </p>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex flex-col gap-1">
                      <span className="font-semibold text-foreground">Audio Replay &amp; Controls:</span>
                      <p className="text-[11px]">
                        Candidates can replay questions at any point or mute audio to read verbatim textual prompts if preferred.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activePillar === "evaluation" && (
              <motion.div
                key="evaluation"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid gap-4 lg:grid-cols-2"
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileCheck2 className="size-4 text-primary" />
                      Grounded Evidence Matching
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Every claim verified against candidate resume and demonstrated answers.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2.5 text-xs text-muted-foreground">
                    <p className="leading-relaxed">
                      CV Tailoring and Evaluation engines operate strictly from grounded evidence. The model is constitutionally forbidden from synthesizing fictional accomplishments, degrees, or certifications.
                    </p>
                    <div className="flex flex-col gap-1.5 pt-1">
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <CheckCircle2 className="size-3.5 text-emerald-500" /> Truthfulness Validator Diff Engine
                      </div>
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <CheckCircle2 className="size-3.5 text-emerald-500" /> ATS Compatibility Parsing &amp; Keyword Weighting
                      </div>
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <CheckCircle2 className="size-3.5 text-emerald-500" /> Grounded Role Fit Index (0–100%)
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="size-4 text-emerald-500" />
                      Recruiter Decision Intelligence
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Actionable candidate scorecards for hiring managers.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-xs text-muted-foreground">
                    <p className="leading-relaxed">
                      Recruiters receive an end-to-end dossier including full video transcript, turn-by-turn question analysis, biometric integrity flags, and comparative candidate rankings.
                    </p>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">Agentic Shortlist Assistant</span>
                        <span className="text-[11px] text-muted-foreground">Ranks 50+ applicants in seconds</span>
                      </div>
                      <Badge variant="outline" className="border-primary/40 text-primary">Automated</Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Conversion Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-primary/5 p-8 text-center sm:p-10 flex flex-col items-center gap-3">
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Ready to experience next-generation interview intelligence?
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl text-pretty">
          Practice role-tailored technical probes, benchmark your skills against industry rubrics, or publish open positions to discover pre-vetted candidates.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/interview" />}
            className="gap-2"
          >
            <Sparkles className="size-4" /> Start Practicing Now
          </Button>
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href="/recruiter" />}
            className="gap-2"
          >
            Open Recruiter Portal <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>
    </div>
  )
}
