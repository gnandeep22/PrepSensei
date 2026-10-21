"use client"

import Link from "next/link"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, ArrowLeft, ArrowRight, Bot, Camera, CameraOff, CheckCircle2, Eye, EyeOff, Loader2, Mic, MicOff, PhoneOff, RotateCcw, ScanFace, Send, ShieldCheck, Sparkles, Trash2, UserRound, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/store"
import { useSession } from "@/lib/auth-client"
import { answerFeedback, demoEvaluation, demoJobs, interviewQuestions, type Assessment, type InterviewType } from "@/lib/demo-data"
import { TOTAL_QUESTIONS, type AnswerResponse, type QAPair, type StartResponse } from "@/lib/interview/protocol"
import { useSpeechRecognition, useSpeechSynthesis } from "@/lib/interview/use-speech"
import { AiInterviewer, type AiState } from "@/components/interview/ai-interviewer"
import { CandidateVideo } from "@/components/interview/candidate-video"
import { JobSelect } from "@/components/job-select"
import { Field, MatchScore, Notice, PageHeader, SkillBar, nativeSelectClass } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useInterviewAnalysis } from "@/lib/face/use-interview-analysis"
import { FaceAnalysisReport } from "@/components/face/face-analysis-report"
import type { InterviewFaceReport } from "@/lib/db/schema"

type Message = { role: "interviewer" | "candidate" | "feedback"; text: string }

const types: InterviewType[] = ["Technical", "Behavioral", "HR"]
const total = TOTAL_QUESTIONS

function InterviewContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const queryJobId = searchParams.get("jobId")

  const { profile, selectedJobId, selectedJob, selectJob, completeInterview, resetInterview, evaluation, addSubmission, allJobs } = useApp()
  const candidateDisplayName = session?.user?.name?.trim() || profile.name?.trim() || "Candidate"
  const availableJobs = allJobs && allJobs.length > 0 ? allJobs : demoJobs
  // Prefer the full selected Job (real JSearch / recruiter results are not in demoJobs).
  const job = selectedJob ?? availableJobs.find((j) => j.id === selectedJobId) ?? availableJobs[0]
  const isCustomJob = !availableJobs.some((j) => j.id === job.id)

  const [recruiterAssessment, setRecruiterAssessment] = useState<Assessment | null>(null)
  const isOfficialInterview = Boolean(
    (job.id.startsWith("recruiter-job-") || job.source === "recruiter") && recruiterAssessment
  )

  const initialJobLoadedRef = useRef<string | null>(null)
  const userSelectedJobRef = useRef<boolean>(false)

  const [type, setType] = useState<InterviewType>("Technical")
  const [stage, setStage] = useState<"setup" | "live" | "done">(evaluation ? "done" : "setup")
  const [messages, setMessages] = useState<Message[]>([])
  // Completed question/answer pairs and the question currently awaiting an answer.
  const [history, setHistory] = useState<QAPair[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<string>("")
  const [answer, setAnswer] = useState("")
  const [thinking, setThinking] = useState(false)
  const [degraded, setDegraded] = useState(false)
  const [aiState, setAiState] = useState<AiState>("idle")
  const [cameraOn, setCameraOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const analysis = useInterviewAnalysis()
  const [faceRegistrationData, setFaceRegistrationData] = useState<any>(null)
  const [isFaceRegistered, setIsFaceRegistered] = useState(false)
  const [registeredDescriptor, setRegisteredDescriptor] = useState<any>(null)
  const [interviewReport, setInterviewReport] = useState<InterviewFaceReport | null>(null)
  const [feedbacks, setFeedbacks] = useState<string[]>([])
  const [isSubmittingToDb, setIsSubmittingToDb] = useState(false)

  // Fetch candidate's registered face biometrics early on mount
  useEffect(() => {
    let active = true
    fetch("/api/face", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status" }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return
        if (data.registered) {
          setIsFaceRegistered(true)
          setFaceRegistrationData(data)
          setRegisteredDescriptor(data.descriptor)
        }
      })
      .catch((err) => console.warn("Failed to load face registration status:", err))

    return () => {
      active = false
    }
  }, [])

  // Sync registered descriptor to active analysis hook if loaded asynchronously
  useEffect(() => {
    if (registeredDescriptor && analysis.running && !analysis.registeredDescriptor) {
      analysis.updateDescriptor(registeredDescriptor)
    }
  }, [registeredDescriptor, analysis])

  // Fetch recruiter published assessment and job if jobId was passed in URL (initial load only)
  useEffect(() => {
    if (!queryJobId) return
    // If the user already manually picked another job or this queryJobId was already handled, do not overwrite
    if (userSelectedJobRef.current || initialJobLoadedRef.current === queryJobId) return
    initialJobLoadedRef.current = queryJobId

    let active = true
    fetch(`/api/assessment?jobId=${encodeURIComponent(queryJobId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return
        if (userSelectedJobRef.current) return
        if (data.assessment) {
          setRecruiterAssessment(data.assessment)
        }
        if (data.job) {
          selectJob(data.job.id, {
            id: data.job.id,
            title: data.job.title,
            company: data.job.company,
            location: data.job.location,
            type: data.job.type,
            experience: data.job.experience,
            salary: data.job.salary,
            requiredSkills: data.job.requiredSkills || [],
            description: data.job.description,
            posted: data.job.posted,
            url: data.job.url,
            source: "recruiter" as any,
          })
        }
      })
      .catch((err) => console.warn("Failed to load recruiter assessment:", err))

    return () => {
      active = false
    }
  }, [queryJobId, selectJob])

  // Handler for target job selection in the interview setup
  const handleJobChange = useCallback(
    (nextId: string, nextJob?: any) => {
      userSelectedJobRef.current = true
      selectJob(nextId, nextJob)

      // If user switched to another recruiter position, update URL and load its assessment
      if (nextId.startsWith("recruiter-job-") || nextJob?.source === "recruiter") {
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `/interview?jobId=${encodeURIComponent(nextId)}`)
        }
        fetch(`/api/assessment?jobId=${encodeURIComponent(nextId)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.assessment) {
              setRecruiterAssessment(data.assessment)
            } else {
              setRecruiterAssessment(null)
            }
          })
          .catch(() => setRecruiterAssessment(null))
      } else {
        // If user switched to a standard practice role: clear query param from URL so it doesn't lock to a recruiter position
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/interview")
        }
        setRecruiterAssessment(null)
      }
    },
    [selectJob],
  )

  const tts = useSpeechSynthesis()
  const stt = useSpeechRecognition()

  // Keep the latest mic preference available inside async speech callbacks.
  const micOnRef = useRef(micOn)
  micOnRef.current = micOn

  // Current question index (0-based) = number of answers already given.
  const index = history.length

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, thinking])

  // While the candidate speaks, mirror the live voice transcript into the
  // editable answer field so they can review, continue speaking, or type.
  useEffect(() => {
    if (stt.transcript) {
      setAnswer(stt.transcript)
    }
  }, [stt.transcript])

  /** Speak a question then open the mic for the candidate's answer. */
  const present = useCallback(
    async (question: string) => {
      setCurrentQuestion(question)
      setAiState("speaking")
      // Pause mic while AI is speaking so question audio is not echoed into transcript
      stt.stop()
      await tts.speak(question)
      setAiState("listening")
      if (micOnRef.current && stt.supported) {
        stt.start()
      }
    },
    [tts, stt],
  )

  const handleVideoReady = useCallback(
    (videoEl: HTMLVideoElement) => {
      if (!videoEl) return
      if (!analysis.running) {
        const desc = registeredDescriptor
        const regPhotos = faceRegistrationData?.photos || registeredDescriptor?.photos || null
        analysis.start(videoEl, desc, {
          registeredPhotos: regPhotos,
        })
      }
    },
    [analysis, registeredDescriptor, faceRegistrationData],
  )

  function handleProceedToInterview() {
    void start()
  }

  async function start() {
    // Prime and unlock media audio immediately inside user click gesture
    try {
      if (typeof window !== "undefined") {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.resume()
        }
        const prime = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA")
        prime.volume = 0.01
        prime.play().catch(() => {})
      }
    } catch {}

    setStage("live")
    setFeedbacks([])

    // Resolve registered face descriptor (supports both array and multi-angle object)
    let descriptorToUse: any = registeredDescriptor
    let regPhotos: any = faceRegistrationData?.photos || registeredDescriptor?.photos || null
    if (!descriptorToUse) {
      try {
        const faceRes = await fetch("/api/face", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status" }),
        })
        if (faceRes.ok) {
          const faceData = await faceRes.json()
          if (faceData.registered && faceData.descriptor) {
            descriptorToUse = faceData.descriptor
            regPhotos = faceData.photos || faceData.descriptor?.photos || null
            setRegisteredDescriptor(faceData.descriptor)
            setFaceRegistrationData(faceData)
            setIsFaceRegistered(true)
          }
        }
      } catch { /* ignore */ }
    }

    // Immediately start face analysis if video is already mounted
    const videoEl = document.querySelector('video[aria-label="Your camera preview"]') as HTMLVideoElement | null
    if (videoEl && videoEl.readyState >= 2 && !analysis.running) {
      analysis.start(videoEl, descriptorToUse || registeredDescriptor, {
        registeredPhotos: regPhotos,
      })
    }

    setMessages([])
    setHistory([])
    setAnswer("")
    setDegraded(false)
    setThinking(true)
    setAiState("thinking")
    stt.reset()
    let question: string
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          jobId: job.id,
          job,
          type,
          profile,
          screeningQuestions: recruiterAssessment?.questions || [],
        }),
      })
      if (!res.ok) throw new Error("start failed")
      const data = (await res.json()) as StartResponse
      question = data.question
    } catch {
      // Fall back to the built-in demo question set.
      question = interviewQuestions[type][0]
      setDegraded(true)
    } finally {
      setThinking(false)
    }
    setMessages([{ role: "interviewer", text: question }])

    // If analysis hasn't started yet because video element was mounting, ensure it starts
    const activeVideo = document.querySelector('video[aria-label="Your camera preview"]') as HTMLVideoElement | null
    if (activeVideo && activeVideo.readyState >= 2 && !analysis.running) {
      analysis.start(activeVideo, descriptorToUse || registeredDescriptor, {
        registeredPhotos: regPhotos,
      })
    }

    void present(question)
  }

  async function submit() {
    stt.stop()
    let text = answer.trim()
    if (!text && stt.isTranscribing) {
      await new Promise((r) => setTimeout(r, 500))
      text = answer.trim() || stt.transcript.trim()
    }
    if (!text || thinking || !currentQuestion) return
    setMessages((m) => [...m, { role: "candidate", text }])
    setAnswer("")
    setThinking(true)
    setAiState("thinking")

    const nextHistory: QAPair[] = [...history, { question: currentQuestion, answer: text }]

    let result: AnswerResponse
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          jobId: job.id,
          job,
          type,
          profile,
          qa: nextHistory,
          screeningQuestions: recruiterAssessment?.questions || [],
        }),
      })
      if (!res.ok) throw new Error("answer failed")
      result = (await res.json()) as AnswerResponse
    } catch {
      result = demoFallback(type, nextHistory.length)
      setDegraded(true)
    }

    setHistory(nextHistory)
    if (result.feedback) {
      setFeedbacks((f) => [...f, result.feedback])
    }
    stt.reset()
    // Do not inject scoring interruptions into live human HR dialogue; conversation remains 100% natural
    setMessages((m) => [
      ...m,
      ...(result.finished || !result.nextQuestion ? [] : [{ role: "interviewer" as const, text: result.nextQuestion }]),
    ])
    setThinking(false)

    if (result.finished) {
      tts.cancel()
      setAiState("idle")
      const finalReport = analysis.stop()
      setInterviewReport(finalReport)

      const evalData = result.evaluation ?? demoEvaluation
      completeInterview(evalData)
      setStage("done")
    } else if (result.nextQuestion) {
      void present(result.nextQuestion)
    }
  }

  function endInterview() {
    tts.cancel()
    stt.stop()
    setAiState("idle")
    const report = analysis.stop()
    setInterviewReport(report)
    if (history.length > 0) {
      const evalData = demoEvaluation
      completeInterview(evalData)
      setStage("done")
    } else {
      restart()
    }
  }

  function toggleMic() {
    setMicOn((on) => {
      const next = !on
      if (next) {
        if (stt.supported && aiState === "listening") stt.start()
      } else {
        stt.stop()
      }
      return next
    })
  }

  function restart() {
    resetInterview()
    setMessages([])
    setHistory([])
    setFeedbacks([])
    setCurrentQuestion("")
    setAnswer("")
    setDegraded(false)
    setStage("setup")
  }

  if (stage === "done" && evaluation) {
    return (
      <>
        <PageHeader
          title="Interview Evaluation"
          description={`${type} interview · ${job.title} at ${job.company}`}
          actions={
            <Button variant="outline" onClick={restart}>
              <RotateCcw className="size-4" /> Practice again
            </Button>
          }
        />

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                🔒 Private Practice Session Complete
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This mock interview was conducted for your personal skill preparation. Your responses, evaluation score, and proctoring metrics are completely private to you and are <strong>never shared with recruiters or employers</strong>.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-primary/40 text-primary text-xs shrink-0">
            Private Practice
          </Badge>
        </div>

        {(job.id.startsWith("recruiter-job-") || (job as any).source === "recruiter") && (
          <div className="rounded-lg border border-border bg-card/60 p-3.5 mb-4 flex items-center justify-between gap-3 text-xs">
            <div className="text-muted-foreground">
              Applied for this role at <strong className="text-foreground">{job.company}</strong> and received an official interview invitation?
            </div>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/interview/official?jobId=${job.id}`} />}>
              Go to Official Interview Room <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>AI-Generated Interview Evaluation</CardTitle>
              <CardDescription>Overall score</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <MatchScore score={evaluation.overall} size="lg" label="overall" />
              <Badge variant="secondary">{total} questions answered</Badge>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Score breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {evaluation.breakdown.map((b) => (
                <SkillBar key={b.label} label={b.label} value={b.score} tone={b.score >= 80 ? "success" : "primary"} />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Strengths</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm">
                {evaluation.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Areas to improve</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm">
                {evaluation.improvements.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Next step</CardTitle>
              <CardDescription>Your improvement areas feed the Skill Gap analysis.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" nativeButton={false} render={<Link href="/skill-gap" />}>
                View skill gaps <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {feedbacks.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Recruiter Notes per Response</CardTitle>
              <CardDescription>Detailed constructive notes recorded for each of your interview answers.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {feedbacks.map((fb, i) => (
                <div key={i} className="rounded-lg border border-border p-3 text-sm">
                  <span className="font-semibold text-primary">Question {i + 1} Note: </span>
                  <span className="text-muted-foreground">{fb}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Notice tone="warning">This evaluation is AI-generated guidance and should not be treated as an objective assessment.</Notice>
        {interviewReport && (
          <FaceAnalysisReport
            report={interviewReport}
            registration={faceRegistrationData}
            candidateName={candidateDisplayName}
          />
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="AI Practice Mock Interview"
        description="A private, video-style mock interview with an AI interviewer. Speak your answers or type them — both work."
      />

      {stage === "setup" ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Set up your practice interview</CardTitle>
              <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                🔒 Private Practice Mode
              </Badge>
            </div>
            <CardDescription>{total} questions tailored to your chosen job role and interview type.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 flex items-start gap-3">
              <ShieldCheck className="size-5 text-primary mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-foreground">100% Private Practice Environment</p>
                <p className="text-muted-foreground mt-0.5">
                  This mock session is for your own personal skill preparation. Real-time proctoring metrics (eye gaze tracking and identity verification) are provided for your learning, but <strong>nothing is ever submitted to recruiters</strong>.
                </p>
              </div>
            </div>

            {(job.id.startsWith("recruiter-job-") || (job as any).source === "recruiter") && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">
                  Practicing for <strong className="text-foreground">{job.title} at {job.company}</strong>. Received an official invitation?
                </span>
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/interview/official?jobId=${job.id}`} />}>
                  Official Interview Room <ArrowRight className="size-3.5 ml-1" />
                </Button>
              </div>
            )}
            <Field label="Target job" htmlFor="job">
              <JobSelect
                id="job"
                value={job.id}
                currentJob={job}
                onChange={handleJobChange}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Interview type</span>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Interview type">
                {types.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={type === t}
                    onClick={() => setType(t)}
                    className={`rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
                      type === t ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Notice>
              You will join a video-style room with an AI interviewer. Camera and microphone are optional — you can turn them
              off and type your answers instead. We never record or analyse your video.
            </Notice>
            <Button onClick={handleProceedToInterview} className="self-start gap-2">
              Enter Interview Room <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <Card className="overflow-hidden border-border/80 shadow-md">
            {/* Header: Clean, professional top bar with status & progress */}
            <CardHeader className="border-b border-border/80 bg-gradient-to-r from-card via-muted/20 to-card px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                      Live AI Session
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium">·</span>
                    <span className="text-xs font-semibold text-foreground tracking-tight">{type} Interview</span>
                  </div>
                  <CardTitle className="text-base sm:text-lg font-bold tracking-tight">
                    {job.title} <span className="text-muted-foreground font-normal">at {job.company}</span>
                  </CardTitle>
                </div>

                {/* Progress bar and counter */}
                <div className="flex flex-col items-start sm:items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Question {Math.min(index + 1, total)} <span className="text-muted-foreground font-normal">of {total}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    {Array.from({ length: total }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-2 rounded-full transition-all duration-500",
                          i < index
                            ? "w-6 bg-primary"
                            : i === index
                            ? "w-8 bg-primary ring-2 ring-primary/30 shadow-xs"
                            : "w-5 bg-muted",
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-5 p-4 sm:p-6">
              {degraded && (
                <Notice tone="warning">
                  The AI interviewer voice engine is unavailable in this environment, using built-in interactive practice questions.
                </Notice>
              )}

              {/* Adaptive Multi-Error Proctoring Alert Deck (Simultaneously adapts to all active violations) */}
              {analysis.running && ((analysis.faceDetected && analysis.identityMismatch) || analysis.multipleFacesDetected || analysis.cameraMovementDetected) && (
                <div className="flex flex-col gap-2 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                  {analysis.faceDetected && analysis.identityMismatch && (
                    <div className="flex items-center gap-3 rounded-xl border border-destructive/60 bg-destructive/15 p-3 text-sm text-destructive shadow-xs animate-pulse">
                      <AlertTriangle className="size-5 shrink-0 text-destructive" />
                      <div className="flex flex-col">
                        <span className="font-bold text-xs sm:text-sm">
                          ⚠ Identity Mismatch Detected
                        </span>
                        <span className="text-xs opacity-90">
                          The vision system detected that the person in frame does not match {candidateDisplayName}&apos;s biometrics.
                        </span>
                      </div>
                    </div>
                  )}

                  {analysis.multipleFacesDetected && (
                    <div className="flex items-center gap-3 rounded-xl border border-amber-500/60 bg-amber-500/15 p-3 text-sm text-amber-800 dark:text-amber-200 shadow-xs animate-in fade-in">
                      <Users className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div className="flex flex-col">
                        <span className="font-bold text-xs sm:text-sm">
                          ⚠ Multiple Persons Detected ({Math.max(2, analysis.faceCount)} faces in frame)
                        </span>
                        <span className="text-xs opacity-90">
                          Ensure only the candidate is present in front of the camera during the session.
                        </span>
                      </div>
                    </div>
                  )}

                  {analysis.cameraMovementDetected && (
                    <div className="flex items-center gap-3 rounded-xl border border-amber-500/60 bg-amber-500/15 p-3 text-sm text-amber-800 dark:text-amber-200 shadow-xs animate-in fade-in">
                      <Camera className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div className="flex flex-col">
                        <span className="font-bold text-xs sm:text-sm">
                          ⚠ Camera Movement Detected
                        </span>
                        <span className="text-xs opacity-90">
                          Camera angle or device shift detected. Please keep your device stable on a flat surface.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Video Grid (AI Interviewer + Candidate Camera) */}
              <div className="grid gap-4 md:grid-cols-2">
                <AiInterviewer
                  state={aiState}
                  question={currentQuestion}
                  onReplay={() => {
                    if (currentQuestion) {
                      void present(currentQuestion)
                    }
                  }}
                />
                <CandidateVideo
                  cameraOn={cameraOn}
                  micOn={micOn}
                  name={candidateDisplayName}
                  faceDetected={analysis.faceDetected}
                  identityMismatch={analysis.identityMismatch}
                  multipleFaces={analysis.faceCount}
                  multipleFacesDetected={analysis.multipleFacesDetected}
                  cameraMovementDetected={analysis.cameraMovementDetected}
                  gazeAway={analysis.currentGaze === "away"}
                  onVideoReady={handleVideoReady}
                />
              </div>

              {/* Sleek Glassmorphic Proctoring Telemetry Dock */}
              {analysis.running && (
                <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/80 bg-muted/30 px-3 py-2 text-xs backdrop-blur-sm">
                  {analysis.faceDetected && analysis.identityMismatch ? (
                    <Badge variant="outline" className="border-destructive/60 bg-destructive/15 text-destructive font-bold animate-pulse flex items-center gap-1">
                      <AlertTriangle className="size-3" /> Identity Mismatch
                    </Badge>
                  ) : analysis.faceDetected && analysis.currentMatch === true ? (
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="size-3 text-emerald-500" /> Identity Verified: {candidateDisplayName}
                    </Badge>
                  ) : null}

                  {analysis.multipleFacesDetected ? (
                    <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold animate-pulse flex items-center gap-1">
                      <Users className="size-3" /> Multiple Faces ({Math.max(2, analysis.faceCount)})
                    </Badge>
                  ) : analysis.faceDetected ? (
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500" /> Face Detected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning flex items-center gap-1 font-medium">
                      <span className="size-1.5 rounded-full bg-warning" /> No Face Detected
                    </Badge>
                  )}

                  {analysis.currentGaze === "toward" && (
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <Eye className="size-3 text-emerald-500" /> Looking at Camera
                    </Badge>
                  )}
                  {analysis.currentGaze === "away" && (
                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                      <EyeOff className="size-3 text-amber-500" /> Looking Away
                    </Badge>
                  )}

                  {analysis.currentMouthMoving && (
                    <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary font-medium flex items-center gap-1.5 animate-pulse">
                      <div className="flex items-center gap-0.5 h-3">
                        <span className="w-0.5 rounded-full bg-primary animate-soundwave-1" />
                        <span className="w-0.5 rounded-full bg-primary animate-soundwave-3" />
                        <span className="w-0.5 rounded-full bg-primary animate-soundwave-2" />
                      </div>
                      Speaking
                    </Badge>
                  )}

                  {analysis.cameraMovementDetected && (
                    <Badge variant="outline" className="border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold animate-pulse flex items-center gap-1">
                      <Camera className="size-3" /> Camera Movement
                    </Badge>
                  )}
                </div>
              )}

              {/* Call Controls Deck */}
              <div className="flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant={micOn ? "secondary" : "outline"}
                  onClick={toggleMic}
                  aria-pressed={micOn}
                  disabled={!stt.supported}
                  className={cn(
                    "rounded-xl px-4 py-2 font-medium transition-all duration-200 hover-lift",
                    micOn && stt.listening && "ring-2 ring-emerald-500/30 border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  )}
                  title={stt.supported ? undefined : "Speech input unavailable — type your answer"}
                >
                  {micOn ? <Mic className="size-4" /> : <MicOff className="size-4 text-destructive" />}
                  {stt.listening ? "Listening…" : micOn ? "Mic on" : "Mic muted"}
                </Button>
                <Button
                  type="button"
                  variant={cameraOn ? "secondary" : "outline"}
                  onClick={() => setCameraOn((c) => !c)}
                  aria-pressed={cameraOn}
                  className="rounded-xl px-4 py-2 font-medium transition-all duration-200 hover-lift"
                >
                  {cameraOn ? <Camera className="size-4" /> : <CameraOff className="size-4 text-destructive" />}
                  {cameraOn ? "Camera on" : "Camera off"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={endInterview}
                  className="rounded-xl px-4 py-2 font-medium text-destructive hover:bg-destructive hover:text-white border-destructive/30 hover:border-destructive transition-all duration-200 hover-lift"
                >
                  <PhoneOff className="size-4" /> End Interview
                </Button>
              </div>

              {/* Candidate Response Studio */}
              <div className="flex flex-col gap-2.5 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-sm backdrop-blur-sm transition-all duration-200 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
                <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground tracking-tight">
                      Your Response
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {stt.supported ? "(speak or type)" : "(type below)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {stt.isTranscribing ? (
                      <span className="text-[11px] text-primary font-semibold flex items-center gap-1 animate-pulse">
                        <Loader2 className="size-3 animate-spin" /> Transcribing speech…
                      </span>
                    ) : (stt as any).silenceSeconds > 0 && (stt as any).silenceSeconds < 5 ? (
                      <span className="text-[11px] text-primary font-semibold flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        Auto-transcribing in {5 - (stt as any).silenceSeconds}s…
                      </span>
                    ) : stt.listening ? (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Audio capture active
                      </span>
                    ) : null}

                    {answer.trim() && (
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {answer.trim().split(/\s+/).length} words
                      </span>
                    )}
                  </div>
                </div>

                <Textarea
                  rows={3}
                  placeholder={stt.supported ? "Speak your answer, or type here…" : "Type your answer here…"}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                      e.preventDefault()
                      submit()
                    }
                  }}
                  className="border-0 shadow-none focus-visible:ring-0 p-0 text-sm leading-relaxed resize-none bg-transparent placeholder:text-muted-foreground/60"
                  aria-label="Your answer"
                />

                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      Press <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px] bg-muted/50">Enter ↵</kbd> to submit · <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px] bg-muted/50">Shift+Enter</kbd> for new line
                    </span>
                    {answer.trim().length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAnswer("")}
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <Trash2 className="size-3 mr-1" /> Clear
                      </Button>
                    )}
                  </div>

                  <Button
                    onClick={submit}
                    disabled={!answer.trim() || thinking}
                    className="gap-1.5 rounded-xl px-4 shadow-sm hover-lift font-semibold"
                  >
                    {thinking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    <span>Submit Answer</span>
                  </Button>
                </div>
              </div>

              {!tts.supported && (
                <p className="text-center text-xs text-muted-foreground">
                  Voice playback is unavailable in this browser — questions are displayed as text above.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Transcript Log */}
          <Card className="rounded-2xl border-border/80 shadow-xs">
            <CardHeader className="py-3 px-4 sm:px-6 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Interview Transcript</CardTitle>
                  <CardDescription className="text-xs">Real-time dialogue record and AI evaluation notes</CardDescription>
                </div>
                <Badge variant="outline" className="text-[11px]">
                  {messages.length} exchanges
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex max-h-72 flex-col gap-3.5 overflow-y-auto p-4 scrollbar-thin">
              {messages.length === 0 && !thinking ? (
                <p className="text-xs text-muted-foreground text-center py-4">The conversation transcript will appear here as you speak.</p>
              ) : (
                messages.map((m, i) => <ChatMessage key={i} message={m} />)
              )}
              {thinking && (
                <div className="flex items-center gap-2 text-xs text-primary font-medium animate-pulse py-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  {messages.length === 0 ? "AI interviewer is formulating your first question…" : "AI interviewer is analyzing your response…"}
                </div>
              )}
              <div ref={endRef} />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

/** Graceful fallback used when the AI interviewer cannot be reached. */
function demoFallback(type: InterviewType, answered: number): AnswerResponse {
  const finished = answered >= total
  const feedback = answerFeedback[(answered - 1 + answerFeedback.length) % answerFeedback.length]
  return {
    feedback,
    score: 75,
    nextQuestion: finished ? null : interviewQuestions[type][answered] ?? null,
    finished,
    evaluation: finished ? demoEvaluation : null,
  }
}

function ChatMessage({ message }: { message: Message }) {
  if (message.role === "feedback") {
    return (
      <div className="ml-9 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-foreground">
        <span className="font-semibold text-primary">Evaluation: </span>
        {message.text}
      </div>
    )
  }
  const interviewer = message.role === "interviewer"
  return (
    <div className={`flex gap-3 ${interviewer ? "" : "flex-row-reverse"}`}>
      <div
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
          interviewer ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
        }`}
      >
        {interviewer ? <Bot className="size-4" /> : <UserRound className="size-4" />}
      </div>
      <div className={`flex max-w-[80%] flex-col gap-1 ${interviewer ? "" : "items-end"}`}>
        <span className="text-[11px] font-medium text-muted-foreground">{interviewer ? "AI Interviewer" : "You"}</span>
        <p className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${interviewer ? "bg-muted" : "bg-primary text-primary-foreground"}`}>{message.text}</p>
      </div>
    </div>
  )
}

export default function InterviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 flex-col items-center justify-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Preparing your interview room…</p>
        </div>
      }
    >
      <InterviewContent />
    </Suspense>
  )
}
