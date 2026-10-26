"use client"

import Link from "next/link"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  ScanFace,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { useSession } from "@/lib/auth-client"
import { demoEvaluation, demoJobs, type Assessment, type InterviewType } from "@/lib/demo-data"
import { TOTAL_QUESTIONS, type AnswerResponse, type QAPair, type StartResponse } from "@/lib/interview/protocol"
import { useSpeechRecognition, useSpeechSynthesis } from "@/lib/interview/use-speech"
import { AiInterviewer, type AiState } from "@/components/interview/ai-interviewer"
import { CandidateVideo } from "@/components/interview/candidate-video"
import { Field, MatchScore, Notice, PageHeader, SkillBar } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useInterviewAnalysis } from "@/lib/face/use-interview-analysis"
import { FaceAnalysisReport } from "@/components/face/face-analysis-report"
import type { InterviewFaceReport } from "@/lib/db/schema"

type Message = { role: "interviewer" | "candidate" | "feedback"; text: string }

function OfficialInterviewContent() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get("jobId") || ""
  const applicationId = searchParams.get("applicationId") || ""

  const { data: session } = useSession()
  const { profile, allJobs } = useApp()
  const candidateDisplayName = session?.user?.name?.trim() || profile.name?.trim() || "Candidate"
  const availableJobs = allJobs && allJobs.length > 0 ? allJobs : demoJobs

  // Stage-Gate States
  const [checkingGate, setCheckingGate] = useState(true)
  const [authenticated, setAuthenticated] = useState<boolean>(false)
  const [hasApplied, setHasApplied] = useState<boolean>(false)
  const [applicationData, setApplicationData] = useState<any | null>(null)
  const [candidateUser, setCandidateUser] = useState<any | null>(null)

  // Job & Assessment
  const [targetJob, setTargetJob] = useState<any | null>(null)
  const [recruiterAssessment, setRecruiterAssessment] = useState<Assessment | null>(null)

  // Interview state
  const [stage, setStage] = useState<"gate" | "setup" | "live" | "done">("gate")
  const [type, setType] = useState<InterviewType>("Technical")
  const [messages, setMessages] = useState<Message[]>([])
  const [history, setHistory] = useState<QAPair[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<string>("")
  const [answer, setAnswer] = useState("")
  const [thinking, setThinking] = useState(false)
  const [aiState, setAiState] = useState<AiState>("idle")
  const [cameraOn, setCameraOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

  // Proctoring & Face Biometrics
  const analysis = useInterviewAnalysis()
  const [faceRegistrationData, setFaceRegistrationData] = useState<any>(null)
  const [isFaceRegistered, setIsFaceRegistered] = useState(false)
  const [registeredDescriptor, setRegisteredDescriptor] = useState<any>(null)
  const [interviewReport, setInterviewReport] = useState<InterviewFaceReport | null>(null)
  const [feedbacks, setFeedbacks] = useState<string[]>([])
  const [isSubmittingToDb, setIsSubmittingToDb] = useState(false)
  const [officialSubmissionResult, setOfficialSubmissionResult] = useState<any | null>(null)
  const [finalEvaluation, setFinalEvaluation] = useState<any | null>(null)

  const tts = useSpeechSynthesis()
  const stt = useSpeechRecognition()
  const micOnRef = useRef(micOn)
  micOnRef.current = micOn

  // 1. Stage-Gate Check: Verify user auth and application status for this specific job
  useEffect(() => {
    let active = true

    async function checkGate() {
      if (!jobId) {
        setCheckingGate(false)
        return
      }

      try {
        // Fetch application status
        const appRes = await fetch(`/api/jobs/apply?jobId=${encodeURIComponent(jobId)}`)
        const appJson = appRes.ok ? await appRes.json() : null

        // Fetch job and recruiter assessment
        const assessRes = await fetch(`/api/assessment?jobId=${encodeURIComponent(jobId)}`)
        const assessJson = assessRes.ok ? await assessRes.json() : null

        // Fetch face registration status
        const faceRes = await fetch("/api/face", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status" }),
        })
        const faceJson = faceRes.ok ? await faceRes.json() : null

        if (!active) return

        if (assessJson?.job) {
          setTargetJob(assessJson.job)
        } else {
          const fallback = availableJobs.find((j) => j.id === jobId) || demoJobs[0]
          setTargetJob(fallback)
        }

        if (assessJson?.assessment) {
          setRecruiterAssessment(assessJson.assessment)
        }

        if (faceJson?.registered) {
          setIsFaceRegistered(true)
          setFaceRegistrationData(faceJson)
          setRegisteredDescriptor(faceJson.descriptor)
        }

        if (appJson) {
          setAuthenticated(Boolean(appJson.authenticated))
          setHasApplied(Boolean(appJson.hasApplied))
          setApplicationData(appJson.application)

          const status = appJson.application?.status
          // Candidate qualifies if advanced or shortlisted by recruiter
          if (appJson.authenticated && (status === "advanced" || status === "shortlisted")) {
            setStage("setup")
          } else {
            setStage("gate")
          }
        }
      } catch (err) {
        console.error("Stage gate check error:", err)
      } finally {
        if (active) setCheckingGate(false)
      }
    }

    void checkGate()

    return () => {
      active = false
    }
  }, [jobId, availableJobs])

  // Sync registered descriptor to active analysis hook
  useEffect(() => {
    if (registeredDescriptor && analysis.running && !analysis.registeredDescriptor) {
      analysis.updateDescriptor(registeredDescriptor)
    }
  }, [registeredDescriptor, analysis])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, thinking])

  useEffect(() => {
    if (stt.transcript) {
      setAnswer(stt.transcript)
    }
  }, [stt.transcript])

  const present = useCallback(
    async (question: string) => {
      setCurrentQuestion(question)
      setAiState("speaking")
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

  async function startOfficialInterview() {
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

    let descriptorToUse: any = registeredDescriptor
    let regPhotos: any = faceRegistrationData?.photos || registeredDescriptor?.photos || null

    const videoEl = document.querySelector('video[aria-label="Your camera preview"]') as HTMLVideoElement | null
    if (videoEl && videoEl.readyState >= 2 && !analysis.running) {
      analysis.start(videoEl, descriptorToUse, {
        registeredPhotos: regPhotos,
      })
    }

    setMessages([])
    setHistory([])
    setAnswer("")
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
          jobId: targetJob?.id || jobId,
          job: targetJob,
          type,
          profile,
          screeningQuestions: recruiterAssessment?.questions || [],
        }),
      })
      if (!res.ok) throw new Error("start failed")
      const data = (await res.json()) as StartResponse
      question = data.question
    } catch {
      question = recruiterAssessment?.questions?.[0]?.question || "Welcome to your official technical interview. To begin, please introduce yourself and summarise your core engineering background."
    } finally {
      setThinking(false)
    }

    setMessages([{ role: "interviewer", text: question }])

    const activeVideo = document.querySelector('video[aria-label="Your camera preview"]') as HTMLVideoElement | null
    if (activeVideo && activeVideo.readyState >= 2 && !analysis.running) {
      analysis.start(activeVideo, descriptorToUse, {
        registeredPhotos: regPhotos,
      })
    }

    void present(question)
  }

  async function submitAnswer() {
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
          jobId: targetJob?.id || jobId,
          job: targetJob,
          type,
          profile,
          qa: nextHistory,
          screeningQuestions: recruiterAssessment?.questions || [],
        }),
      })
      if (!res.ok) throw new Error("answer failed")
      result = (await res.json()) as AnswerResponse
    } catch {
      result = {
        score: 75,
        finished: nextHistory.length >= (recruiterAssessment?.questions?.length || TOTAL_QUESTIONS),
        nextQuestion: null,
        feedback: "Response recorded.",
        evaluation: demoEvaluation,
      }
    }

    setHistory(nextHistory)
    if (result.feedback) {
      setFeedbacks((f) => [...f, result.feedback])
    }
    stt.reset()

    setMessages((m) => [
      ...m,
      ...(result.finished || !result.nextQuestion ? [] : [{ role: "interviewer" as const, text: result.nextQuestion }]),
    ])
    setThinking(false)

    if (result.finished) {
      await completeAndSubmitToRecruiter(nextHistory, result.evaluation ?? demoEvaluation)
    } else if (result.nextQuestion) {
      void present(result.nextQuestion)
    }
  }

  async function completeAndSubmitToRecruiter(finalHistory: QAPair[], evalData: any) {
    tts.cancel()
    stt.stop()
    setAiState("idle")
    const finalReport = analysis.stop()
    setInterviewReport(finalReport)
    setFinalEvaluation(evalData)
    setStage("done")

    const answersObj: Record<string, string> = {}
    finalHistory.forEach((item, idx) => {
      answersObj[`q-${idx + 1}`] = item.answer
    })

    setIsSubmittingToDb(true)
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isOfficial: true,
          isPractice: false,
          assessmentId: recruiterAssessment?.id || undefined,
          jobId: targetJob?.id || jobId,
          answers: answersObj,
          durationSeconds: finalReport.totalDurationSec,
          interview: evalData,
          report: finalReport,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setOfficialSubmissionResult(data.submission)
      }
    } catch (err) {
      console.error("Official interview submission error:", err)
    } finally {
      setIsSubmittingToDb(false)
    }
  }

  function handleEndEarly() {
    if (history.length > 0) {
      void completeAndSubmitToRecruiter(history, demoEvaluation)
    } else {
      setStage("setup")
    }
  }

  function toggleCamera() {
    setCameraOn((c) => !c)
  }

  function toggleMic() {
    setMicOn((m) => {
      const next = !m
      if (next && aiState === "listening" && stt.supported) {
        stt.start()
      } else {
        stt.stop()
      }
      return next
    })
  }

  // -------------------------------------------------------------------------
  // RENDER: Loading Gate Check
  // -------------------------------------------------------------------------
  if (checkingGate) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="size-10 animate-spin text-primary" />
        <h2 className="text-lg font-semibold">Verifying Official Interview Invitation...</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Checking your candidate credentials and recruiter shortlisting status with the hiring portal.
        </p>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // RENDER: STAGE-GATE ACCESS RESTRICTED SCREEN
  // -------------------------------------------------------------------------
  if (stage === "gate") {
    const jobTitle = targetJob?.title || "Open Position"
    const company = targetJob?.company || "Hiring Partner"
    const currentStatus = applicationData?.status

    return (
      <div className="mx-auto max-w-2xl py-6 flex flex-col gap-6">
        <PageHeader
          title="Official Job Interview Room"
          description={`Verified Proctored Assessment · ${jobTitle} at ${company}`}
        />

        <Card className="glass-panel border-amber-500/30 bg-amber-500/[0.03]">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-4 ring-amber-500/10">
              <Lock className="size-6" />
            </div>
            <CardTitle className="text-xl">
              {!authenticated
                ? "Candidate Sign-In Required"
                : !hasApplied
                ? "Official Invitation Required"
                : currentStatus === "applied"
                ? "Application Under Review"
                : "Application Not Advanced"}
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              {!authenticated
                ? "You must be signed in with your candidate account to access your official proctored assessment."
                : !hasApplied
                ? `You have not applied for the ${jobTitle} position at ${company}.`
                : currentStatus === "applied"
                ? `Your application for ${jobTitle} at ${company} was submitted and is undergoing resume evaluation.`
                : `The recruiting team has evaluated your application and concluded this cycle.`}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-5 pt-4">
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground flex flex-col gap-2">
              <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                <Sparkles className="size-4 text-primary" /> How Official Proctored Interviews Work:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <strong>Step 1 (Application):</strong> Candidate applies with resume via the Jobs Portal.
                </li>
                <li>
                  <strong>Step 2 (RAG Screening):</strong> The Gemini RAG Shortlist Agent evaluates and ranks all resumes against the role requirements.
                </li>
                <li>
                  <strong>Step 3 (Advancement):</strong> Recruiter selects top rankers and issues automated interview invitations.
                </li>
                <li>
                  <strong>Step 4 (Official Proctored Session):</strong> Only invited candidates access this proctored assessment room with results sent directly to the employer.
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {!authenticated ? (
                <>
                  <Button
                    className="w-full sm:w-auto gap-2"
                    nativeButton={false}
                    render={<Link href={`/sign-in?callbackUrl=/interview/official?jobId=${jobId}`} />}
                  >
                    Sign In to Candidate Account <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    nativeButton={false}
                    render={<Link href="/interview" />}
                  >
                    Take Practice Interview Instead
                  </Button>
                </>
              ) : !hasApplied ? (
                <>
                  <Button
                    className="w-full sm:w-auto gap-2"
                    nativeButton={false}
                    render={<Link href="/jobs" />}
                  >
                    <Briefcase className="size-4" /> View Openings & Apply
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    nativeButton={false}
                    render={<Link href="/interview" />}
                  >
                    Go to Practice Room
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="w-full sm:w-auto gap-2"
                    nativeButton={false}
                    render={<Link href="/interview" />}
                  >
                    <Sparkles className="size-4" /> Practice in Self-Prep Mode
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    nativeButton={false}
                    render={<Link href="/jobs" />}
                  >
                    Browse Other Opportunities
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // RENDER: SETUP STAGE (ACCESS GRANTED)
  // -------------------------------------------------------------------------
  if (stage === "setup") {
    const jobTitle = targetJob?.title || "Target Position"
    const company = targetJob?.company || "Hiring Partner"
    const questionCount = recruiterAssessment?.questions?.length || TOTAL_QUESTIONS

    return (
      <div className="mx-auto max-w-3xl py-6 flex flex-col gap-6">
        <PageHeader
          title="Official Job Interview Room"
          description={`Verified Candidate Assessment · ${jobTitle} at ${company}`}
        />

        <div className="glass-panel rounded-lg border-emerald-500/40 bg-emerald-500/[0.06] p-4 flex items-start gap-3">
          <CheckCircle2 className="size-5 text-emerald-500 mt-0.5 shrink-0" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-foreground text-sm flex items-center gap-2">
              <span>Verified Invitation Approved</span>
              <Badge variant="default" className="bg-emerald-600 text-white font-semibold text-[11px]">
                Stage: {applicationData?.status === "advanced" ? "Advanced to Interview" : "Shortlisted Candidate"}
              </Badge>
            </p>
            <p className="text-muted-foreground mt-1">
              You are taking the official proctored assessment for <strong>{jobTitle}</strong> at <strong>{company}</strong>. Your spoken/typed responses, AI evaluation, and biometric integrity audit will be submitted directly to the {company} hiring team.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column: Camera Preview with Dotted Face Guide */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Camera & Biometrics Test</span>
                {isFaceRegistered ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-[11px] flex items-center gap-1">
                    <UserCheck className="size-3" /> Face ID Linked
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 text-[11px]">
                    Guest Biometrics
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Check your camera preview, framing, and microphone before starting.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <CandidateVideo
                cameraOn={cameraOn}
                micOn={micOn}
                name={candidateDisplayName}
                identityMismatch={analysis.identityMismatch}
                multipleFaces={analysis.multipleFaces}
                onVideoReady={handleVideoReady}
              />

              <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                <Button variant="outline" size="sm" onClick={toggleCamera} className="flex-1 gap-1.5">
                  <Camera className="size-3.5" /> {cameraOn ? "Camera On" : "Camera Off"}
                </Button>
                <Button variant="outline" size="sm" onClick={toggleMic} className="flex-1 gap-1.5">
                  {micOn ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
                  {micOn ? "Mic Active" : "Mic Muted"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Assessment Details & Start CTA */}
          <Card className="flex flex-col justify-between">
            <div>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Assessment Information</CardTitle>
                <CardDescription className="text-xs">
                  Review the assessment requirements before starting your official session.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3.5 text-xs">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Company:</span>
                  <span className="font-semibold text-foreground">{company}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Target Role:</span>
                  <span className="font-semibold text-foreground">{jobTitle}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Interview Format:</span>
                  <span className="font-semibold text-foreground">{type} Proctored Interview</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Total Questions:</span>
                  <span className="font-semibold text-foreground">{questionCount} Questions</span>
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs flex flex-col gap-1.5 mt-2">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-primary" /> Active Proctoring Protocol
                  </p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    This interview uses automated eye-gaze tracking and biometric continuous authentication. Please maintain focus toward the screen and camera during questions.
                  </p>
                </div>
              </CardContent>
            </div>

            <div className="p-6 pt-0">
              <Button onClick={startOfficialInterview} className="w-full gap-2 text-sm font-semibold">
                Start Official Assessment <ArrowRight className="size-4" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // RENDER: LIVE INTERVIEW STAGE
  // -------------------------------------------------------------------------
  if (stage === "live") {
    const jobTitle = targetJob?.title || "Target Position"
    const company = targetJob?.company || "Hiring Partner"
    const totalQuestions = recruiterAssessment?.questions?.length || TOTAL_QUESTIONS

    return (
      <div className="mx-auto max-w-4xl py-4 flex flex-col gap-4">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-primary text-primary-foreground text-xs font-semibold">
                Official Assessment
              </Badge>
              <h2 className="text-base font-semibold">{jobTitle} · {company}</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Question {history.length + 1} of {totalQuestions} · Proctoring Active
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" onClick={handleEndEarly} className="gap-1.5 text-xs">
              <PhoneOff className="size-3.5" /> End Assessment
            </Button>
          </div>
        </div>

        {/* Adaptive Multi-Error Proctoring Alert Deck (Simultaneously adapts to all active violations) */}
        {analysis.running && ((analysis.faceDetected && analysis.identityMismatch) || analysis.multipleFacesDetected || analysis.cameraMovementDetected) && (
          <div className="flex flex-col gap-2 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
            {analysis.faceDetected && analysis.identityMismatch && (
              <div className="flex items-center gap-3 rounded-xl border border-destructive/60 bg-destructive/15 p-3 text-sm text-destructive shadow-xs animate-pulse">
                <AlertTriangle className="size-5 shrink-0 text-destructive" />
                <div className="flex flex-col">
                  <span className="font-bold text-xs sm:text-sm">
                           Identity mismatch detected
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
                           Multiple people detected ({Math.max(2, analysis.faceCount)} faces in frame)
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
                           Camera movement detected
                  </span>
                  <span className="text-xs opacity-90">
                    Camera angle or device shift detected. Please keep your device stable on a flat surface.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Video Call Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* AI Interviewer Tile */}
          <AiInterviewer
            state={aiState}
            statusText={
              aiState === "speaking"
                ? "AI Interviewer asking question..."
                : aiState === "thinking"
                ? "Evaluating answer..."
                : "Listening to candidate..."
            }
          />

          {/* Candidate Live Video Tile */}
          <CandidateVideo
            cameraOn={cameraOn}
            micOn={micOn}
            name={candidateDisplayName}
            faceDetected={analysis.faceDetected}
            identityMismatch={analysis.identityMismatch}
            multipleFaces={analysis.multipleFaces}
            multipleFacesDetected={analysis.multipleFacesDetected}
            cameraMovementDetected={analysis.cameraMovementDetected}
            gazeAway={analysis.currentGaze === "away"}
            onVideoReady={handleVideoReady}
          />
        </div>

        {/* Live Proctoring Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card/60 px-4 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full ${
                  !analysis.faceDetected
                    ? "bg-muted-foreground"
                    : analysis.currentGaze === "away"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
              />
              <strong className="text-foreground">Gaze:</strong>{" "}
              {!analysis.faceDetected ? (
                <span className="text-muted-foreground">Detecting...</span>
              ) : analysis.currentGaze === "away" ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">Looking away</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Looking at camera</span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full ${
                  !analysis.faceDetected
                    ? "bg-muted-foreground"
                    : analysis.identityMismatch
                    ? "bg-destructive animate-pulse"
                    : "bg-emerald-500"
                }`}
              />
              <strong className="text-foreground">Identity:</strong>{" "}
              {!analysis.faceDetected ? (
                <span className="text-muted-foreground">No Face</span>
              ) : analysis.identityMismatch ? (
                <span className="text-destructive font-medium">Mismatch Flagged</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Verified</span>
              )}
            </span>
            {analysis.multipleFacesDetected && (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                Multiple Faces ({Math.max(2, analysis.faceCount)})
              </span>
            )}
            {analysis.cameraMovementDetected && (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium animate-pulse">
                <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                Camera Movement Detected
              </span>
            )}
            {analysis.currentMouthMoving && (
              <span className="flex items-center gap-1.5 text-primary font-medium">
                <span className="size-2 rounded-full bg-primary animate-pulse" />
                Speaking
              </span>
            )}
          </div>
          <div className="text-muted-foreground">
            Spoken responses are transcribed automatically in real time.
          </div>
        </div>

        {/* Live Conversation Stream */}
        <Card className="min-h-[160px] max-h-[260px] overflow-y-auto">
          <CardContent className="flex flex-col gap-3 p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1 rounded-lg p-3 text-sm ${
                  m.role === "interviewer"
                    ? "bg-primary/5 border border-primary/20"
                    : "bg-muted/50 border border-border"
                }`}
              >
                <span className="font-semibold text-xs text-primary">
                  {m.role === "interviewer" ? "AI Interviewer (Official Assessment)" : "Your Response"}
                </span>
                <p className="text-foreground leading-relaxed">{m.text}</p>
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                <Loader2 className="size-3.5 animate-spin" /> Evaluating answer and advancing...
              </div>
            )}
            <div ref={endRef} />
          </CardContent>
        </Card>

        {/* Candidate Answer Input */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Speak via microphone or edit your answer below:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMic}
                className="hover:text-foreground flex items-center gap-1 cursor-pointer"
              >
                {micOn ? <Mic className="size-3.5 text-primary" /> : <MicOff className="size-3.5 text-muted-foreground" />}
                {micOn ? "Mic On" : "Mic Muted"}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer will appear here as you speak, or you can type directly..."
              className="min-h-[70px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void submitAnswer()
                }
              }}
            />
            <Button
              onClick={() => void submitAnswer()}
              disabled={thinking || !answer.trim()}
              className="gap-2 shrink-0 self-end px-5"
            >
              <Send className="size-4" /> Submit Answer
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // RENDER: DONE / CONFIRMATION STAGE
  // -------------------------------------------------------------------------
  if (stage === "done") {
    const jobTitle = targetJob?.title || "Target Position"
    const company = targetJob?.company || "Hiring Partner"

    return (
      <div className="mx-auto max-w-3xl py-6 flex flex-col gap-6">
        <PageHeader
          title="Official Interview Completed"
          description={`Proctored Assessment · ${jobTitle} at ${company}`}
        />

        {/* Confirmation Banner */}
        <div className="glass-panel rounded-lg border-emerald-500/40 bg-emerald-500/[0.06] p-5 flex items-start gap-4">
          <div className="rounded-full bg-emerald-500/20 p-2 text-emerald-600 shrink-0">
            <CheckCircle2 className="size-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">
              Official Assessment Successfully Submitted to Recruiter!
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Your responses, AI evaluation score, and biometric proctoring audit have been securely recorded in {company}'s recruiting portal. The hiring team will review your submission and communicate next steps via email.
            </p>
            {officialSubmissionResult?.id && (
              <p className="text-[11px] font-mono text-muted-foreground mt-2">
                Submission ID: <strong className="text-foreground">{officialSubmissionResult.id}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Score & Summary Grid */}
        {finalEvaluation && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Official Score</CardTitle>
                <CardDescription className="text-xs">Overall Performance</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-2 pt-2">
                <MatchScore score={finalEvaluation.overall} size="lg" label="overall" />
                <Badge variant="secondary" className="text-xs mt-1">
                  {history.length} Questions Evaluated
                </Badge>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Competency Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-2">
                {finalEvaluation.breakdown?.map((b: any) => (
                  <SkillBar key={b.label} label={b.label} value={b.score} tone={b.score >= 75 ? "success" : "primary"} />
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Biometric Proctoring Report */}
        {interviewReport && (
          <FaceAnalysisReport
            report={interviewReport}
            registration={faceRegistrationData}
            candidateName={candidateDisplayName}
          />
        )}

        {/* Navigation Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t">
          <Button variant="outline" nativeButton={false} render={<Link href="/jobs" />}>
            <ArrowLeft className="size-4 mr-1.5" /> Back to Jobs Portal
          </Button>
          <Button variant="secondary" nativeButton={false} render={<Link href="/interview" />}>
            Practice More Mock Interviews <ArrowRight className="size-4 ml-1.5" />
          </Button>
        </div>
      </div>
    )
  }

  return null
}

export default function OfficialInterviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading Official Interview Portal...</p>
        </div>
      }
    >
      <OfficialInterviewContent />
    </Suspense>
  )
}
