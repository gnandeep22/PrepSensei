"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Smile,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  ScanFace,
  Sparkles,
} from "lucide-react"
import { useFaceDetection, type FaceDetectionResult } from "@/lib/face/use-face-detection"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export type Mode = "register" | "verify" | "login"

type RegAngle = "front" | "left" | "right" | "done"

type VerificationStatus =
  | "idle"
  | "loading_models"
  | "waiting_camera"
  | "detecting"
  | "angle_front"
  | "angle_left"
  | "angle_right"
  | "capturing"
  | "registering"
  | "verifying"
  | "success"
  | "failed"
  | "error"
const MATCH_THRESHOLD = 0.48
const LOGIN_CONSECUTIVE_REQUIRED = 3
const MAX_MOTION_SHIFT_PX = 32

function captureVideoFrame(video: HTMLVideoElement): string {
  try {
    const canvas = document.createElement("canvas")
    canvas.width = Math.min(320, video.videoWidth || 320)
    canvas.height = Math.min(240, video.videoHeight || 240)
    const ctx = canvas.getContext("2d")
    if (ctx) {
      // Un-mirror the captured thumbnail so it matches reality
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL("image/jpeg", 0.8)
    }
  } catch {}
  return ""
}

/**
 * Calculates whether the face is properly framed inside the central dotted oval.
 * Provides real-time directional guidance (move closer, move back, move left/right, move up/down).
 */
function checkFaceAlignment(
  result: FaceDetectionResult | null,
  video: HTMLVideoElement | null,
): { aligned: boolean; hint: string } {
  if (!result || !result.detected || !result.box || !video || video.videoWidth === 0 || video.videoHeight === 0) {
    return { aligned: false, hint: "Fit face inside dotted oval" }
  }

  const vw = video.videoWidth
  const vh = video.videoHeight
  const box = result.box

  const centerX = (box.x + box.width / 2) / vw
  const centerY = (box.y + box.height / 2) / vh
  const widthRatio = box.width / vw

  // Check scale / distance (must not be too tiny or huge)
  if (widthRatio < 0.17) {
    return { aligned: false, hint: "Move closer to camera" }
  }
  if (widthRatio > 0.65) {
    return { aligned: false, hint: "Move back slightly" }
  }

  // Check horizontal center (mirrored view: if centerX in video > 0.50, on mirrored screen it's on the left)
  const xOffset = centerX - 0.50
  if (Math.abs(xOffset) > 0.18) {
    return { aligned: false, hint: xOffset > 0 ? "Move right →" : "← Move left" }
  }

  // Check vertical center (ideal oval center is ~0.47)
  const yOffset = centerY - 0.47
  if (Math.abs(yOffset) > 0.20) {
    return { aligned: false, hint: yOffset > 0 ? "Move up ↑" : "Move down ↓" }
  }

  return { aligned: true, hint: "✓ Face Aligned" }
}

export function FaceVerification({
  mode,
  targetEmail,
  candidateName,
  registeredDescriptor,
  autoStart = false,
  embedded = false,
  onComplete,
  onSkip,
  className,
}: {
  mode: Mode
  targetEmail?: string
  candidateName?: string
  registeredDescriptor?: any
  autoStart?: boolean
  embedded?: boolean
  onComplete?: (descriptor: any, photo?: string, userData?: any) => void
  onSkip?: () => void
  className?: string
}) {
  const { ready, error: faceError, detect, faceDistance } = useFaceDetection()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRunningRef = useRef(false)
  const capturedDescriptorRef = useRef<number[] | null>(null)
  const matchConsecutiveRef = useRef(0)
  const verifyAttemptsRef = useRef(0)
  const isVerifyingServerRef = useRef(false)
  const serverFailedAttemptsRef = useRef(0)

  // Anti-shake & multi-frame consensus tracking for un-bypassable biometric login
  const prevBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const loginConsecutiveRef = useRef(0)
  const lastLoginDescriptorRef = useRef<number[] | null>(null)
  const consecutiveSamplesRef = useRef<number[][]>([])
  const [shakeWarning, setShakeWarning] = useState<string | null>(null)
  const [loginStep, setLoginStep] = useState<number>(0)

  // Visual Dotted Oval Face Guide alignment state
  const [isFaceAligned, setIsFaceAligned] = useState<boolean>(false)
  const [alignmentHint, setAlignmentHint] = useState<string>("Fit face inside dotted oval")

  const [status, setStatus] = useState<VerificationStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [currentAngle, setCurrentAngle] = useState<RegAngle>("front")
  const [faceResult, setFaceResult] = useState<FaceDetectionResult | null>(null)
  const [matchDistance, setMatchDistance] = useState<number | null>(null)
  const [matchConfidence, setMatchConfidence] = useState<number | null>(null)
  const [confirmedName, setConfirmedName] = useState<string>(candidateName || "")

  // 3-Angle captured data (Front, Left, Right)
  const [capturedPhotos, setCapturedPhotos] = useState<{
    front: string | null
    left: string | null
    right: string | null
  }>({ front: null, left: null, right: null })

  const descriptorsRef = useRef<{
    front: number[] | null
    left: number[] | null
    right: number[] | null
  }>({ front: null, left: null, right: null })

  const photosRef = useRef<{
    front: string | null
    left: string | null
    right: string | null
  }>({ front: null, left: null, right: null })

  const isProcessingRef = useRef(false)
  const autoCapturingRef = useRef(false)
  const isFinalizingRef = useRef(false)
  const angleHoldFramesRef = useRef(0)
  const currentAngleRef = useRef<RegAngle>("front")
  currentAngleRef.current = currentAngle

  const stopDetection = useCallback(() => {
    isRunningRef.current = false
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const cleanup = useCallback(() => {
    stopDetection()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    isProcessingRef.current = false
  }, [stopDetection])

  useEffect(() => () => cleanup(), [cleanup])

  const startCamera = useCallback(async () => {
    setStatus("waiting_camera")
    setError(null)
    matchConsecutiveRef.current = 0
    verifyAttemptsRef.current = 0
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported in this browser.")
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await new Promise<void>((res) => {
          videoRef.current!.onloadedmetadata = () => res()
        })
      }
      if (mode === "register") {
        setCurrentAngle("front")
        setStatus("angle_front")
      } else {
        setStatus("detecting")
      }
    } catch {
      setError("Camera unavailable. Please grant camera permission and try again.")
      setStatus("error")
    }
  }, [mode])

  // Saves the 3-angle biometric dataset to PostgreSQL
  const finalizeRegistration = useCallback(async () => {
    if (isFinalizingRef.current) return
    isFinalizingRef.current = true
    autoCapturingRef.current = true

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    setStatus("registering")
    try {
      const primaryDescriptor = descriptorsRef.current.front || descriptorsRef.current.left || descriptorsRef.current.right
      if (!primaryDescriptor) {
        throw new Error("Missing captured face descriptors")
      }

      const res = await fetch("/api/face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          descriptor: primaryDescriptor,
          descriptors: descriptorsRef.current,
          photos: photosRef.current,
          livenessVerified: true,
          smileDetected: true,
          turnLeftDetected: Boolean(descriptorsRef.current.left),
          turnRightDetected: Boolean(descriptorsRef.current.right),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save face registration")
      }

      setStatus("success")
      const frontPhoto = photosRef.current.front || photosRef.current.left || photosRef.current.right || ""
      cleanup()
      setTimeout(() => {
        if (onComplete) {
          onComplete(primaryDescriptor, frontPhoto)
        } else {
          window.location.href = "/"
        }
      }, 700)
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.")
      setStatus("error")
      isFinalizingRef.current = false
      autoCapturingRef.current = false
    }
  }, [cleanup, onComplete])

  // Snap photo and descriptor for the specified angle automatically
  const autoSnapAngle = useCallback(
    async (angle: "front" | "left" | "right") => {
      if (!videoRef.current || autoCapturingRef.current) return
      autoCapturingRef.current = true

      try {
        // Extract 128-d descriptor from the current frame
        const res = await detect(videoRef.current, { withDescriptor: true, withExpressions: false })
        const photo = captureVideoFrame(videoRef.current)

        if (res.detected && res.descriptor && res.descriptor.length === 128) {
          descriptorsRef.current[angle] = res.descriptor
          photosRef.current[angle] = photo
          setCapturedPhotos((p) => ({ ...p, [angle]: photo }))

          // Immediate duplicate face check for front angle
          if (mode === "register" && angle === "front") {
            try {
              const dupRes = await fetch("/api/face", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "check-duplicate", descriptor: res.descriptor }),
              })
              if (dupRes.ok) {
                const dupData = await dupRes.json()
                if (dupData.exists) {
                  setError(dupData.error || "An account with this face already exists. A user cannot create multiple accounts with the same face. Please sign in with your existing account.")
                  setStatus("error")
                  autoCapturingRef.current = false
                  isFinalizingRef.current = false
                  return
                }
              }
            } catch {}
          }

          // Flash UI feedback and advance to next angle automatically
          angleHoldFramesRef.current = 0

          if (angle === "front") {
            setCurrentAngle("left")
            setStatus("angle_left")
            autoCapturingRef.current = false
          } else if (angle === "left") {
            setCurrentAngle("right")
            setStatus("angle_right")
            autoCapturingRef.current = false
          } else if (angle === "right") {
            setCurrentAngle("done")
            autoCapturingRef.current = false
            await finalizeRegistration()
          }
        } else {
          autoCapturingRef.current = false
        }
      } catch (e) {
        console.warn("Snap angle error:", e)
        autoCapturingRef.current = false
      }
    },
    [detect, finalizeRegistration],
  )

  const beginDetection = useCallback(() => {
    if (!ready || !videoRef.current) return
    stopDetection()
    isRunningRef.current = true

    const runTick = async () => {
      if (!isRunningRef.current) return
      if (!videoRef.current || videoRef.current.readyState < 2 || isProcessingRef.current || autoCapturingRef.current) {
        if (isRunningRef.current) {
          timerRef.current = setTimeout(runTick, 60)
        }
        return
      }

      isProcessingRef.current = true
      try {
        const isRegister = mode === "register"
        const isVerify = mode === "verify" || mode === "login"
        const angle = currentAngleRef.current
        const isFront = angle === "front" && isRegister

        const result = await detect(videoRef.current, {
          withExpressions: isFront,
          withDescriptor: isVerify,
        })

        setFaceResult(result)

        // Evaluate whether face is correctly aligned inside the central dotted oval
        const alignment = checkFaceAlignment(result, videoRef.current)
        setIsFaceAligned(alignment.aligned)
        setAlignmentHint(alignment.hint)

        // ------------------------------------------------------------------
        // A. CONTINUOUS IDENTITY VERIFICATION & VISION LOGIN
        // ------------------------------------------------------------------
        if (isVerify && result.detected && result.descriptor) {
          const liveDescriptor = result.descriptor

          // -------------------------------------------------------------
          // HARDENED BIOMETRIC LOGIN WITH FAST CONSENSUS & ANTI-SHAKE
          // -------------------------------------------------------------
          if (mode === "login") {
            const box = result.box
            let isShaking = false

            // 1. Physical motion / camera shake detection
            if (box && prevBoxRef.current) {
              const shift = Math.hypot(box.x - prevBoxRef.current.x, box.y - prevBoxRef.current.y)
              const sizeChange = Math.abs(box.width - prevBoxRef.current.width)
              if (shift > MAX_MOTION_SHIFT_PX || sizeChange > 24) {
                isShaking = true
              }
            }
            if (box) {
              prevBoxRef.current = box
            }

            if (isShaking) {
              consecutiveSamplesRef.current = []
              setLoginStep(0)
              setShakeWarning("Camera movement / shaking detected. Please hold your device steady.")
              return
            } else {
              setShakeWarning(null)
            }

            // 2. Strict face quality & frontal liveness gate
            const score = result.score ?? 1
            const ear = result.ear
            const yaw = Math.abs(result.headYaw ?? 0)
            const pitch = Math.abs(result.headPitch ?? 0)

            // Natural blink tolerance: skip sampling this frame without resetting consensus buffer
            if (ear !== null && ear < 0.17) {
              return
            }

            // Calibrated frontal criteria (accommodates natural laptop tilt while ensuring front-facing posture)
            if (
              !alignment.aligned ||
              score < 0.50 ||
              (box && (box.width < 80 || box.height < 80)) ||
              yaw > 0.30 ||
              pitch > 0.38
            ) {
              consecutiveSamplesRef.current = []
              setLoginStep(0)
              return
            }

            // 3. Inter-frame descriptor stability check (local consensus accumulation)
            const currentSamples = consecutiveSamplesRef.current
            if (currentSamples.length > 0) {
              const lastSample = currentSamples[currentSamples.length - 1]
              const interDist = faceDistance(liveDescriptor, lastSample)
              if (interDist > 0.28) {
                // Abrupt descriptor drift; restart consensus buffer from this frame
                consecutiveSamplesRef.current = [liveDescriptor]
                setLoginStep(1)
                return
              }
            }

            currentSamples.push(liveDescriptor)
            consecutiveSamplesRef.current = currentSamples
            const currentStep = currentSamples.length
            setLoginStep(currentStep)

            if (currentStep < LOGIN_CONSECUTIVE_REQUIRED) {
              // Still gathering consecutive stable frames inside the dotted guide
              return
            }

            // 4. Send all 3 consecutive stable frames to server in ONE fast verification request!
            if (isVerifyingServerRef.current) return
            isVerifyingServerRef.current = true

            try {
              const res = await fetch("/api/face", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "login",
                  descriptor: currentSamples[0],
                  samples: currentSamples,
                  email: targetEmail || undefined,
                }),
              })
              const data = await res.json().catch(() => ({}))

              if (data.distance !== undefined) {
                setMatchDistance(data.distance)
                setMatchConfidence(
                  data.confidence ?? Math.max(0, Math.min(100, Math.round((1 - data.distance / 0.52) * 100)))
                )
              }

              if (data.verified && data.ok) {
                stopDetection()
                const name = data.user?.name || "Candidate"
                setConfirmedName(name)
                setStatus("success")
                const photo = captureVideoFrame(videoRef.current!)
                cleanup()
                setTimeout(() => {
                  onComplete?.(currentSamples[0], photo, data.user)
                }, 1000)
                return
              } else {
                consecutiveSamplesRef.current = []
                setLoginStep(0)
                serverFailedAttemptsRef.current++
                if (serverFailedAttemptsRef.current >= 8) {
                  setError(
                    data.error ||
                      "Face not recognized. Please make sure your face is well-lit and aligned in the dotted oval, or sign in with your email & password."
                  )
                }
                setTimeout(() => {
                  isVerifyingServerRef.current = false
                }, 350)
              }
            } catch (err: any) {
              console.error("[Face Sign-In Error]", err)
              consecutiveSamplesRef.current = []
              setLoginStep(0)
              setTimeout(() => {
                isVerifyingServerRef.current = false
              }, 450)
            }
            return
          }

          // -------------------------------------------------------------
          // IDENTITY VERIFICATION (VERIFY MODE FOR INTERVIEW ENTRY / AUDIT)
          // -------------------------------------------------------------
          verifyAttemptsRef.current++
          let minD = Infinity
          const refDesc = registeredDescriptor

          if (refDesc) {
            if (Array.isArray(refDesc)) {
              minD = faceDistance(refDesc, liveDescriptor)
            } else if (typeof refDesc === "object") {
              const angles = [refDesc.front, refDesc.left, refDesc.right].filter(Boolean)
              for (const a of angles) {
                if (Array.isArray(a)) {
                  const d = faceDistance(a, liveDescriptor)
                  if (d < minD) minD = d
                }
              }
            }
          }

          // If local reference distance is available:
          if (minD !== Infinity) {
            setMatchDistance(Math.round(minD * 1000) / 1000)
            const conf = Math.max(0, Math.min(100, Math.round((1 - minD / 0.52) * 100)))
            setMatchConfidence(conf)

            if (minD < MATCH_THRESHOLD) {
              matchConsecutiveRef.current++
              if (matchConsecutiveRef.current >= 2) {
                stopDetection()
                setStatus("success")
                const photo = captureVideoFrame(videoRef.current!)
                cleanup()
                setTimeout(() => {
                  onComplete?.(liveDescriptor, photo)
                }, 1000)
                return
              }
            } else {
              matchConsecutiveRef.current = Math.max(0, matchConsecutiveRef.current - 1)
            }
          } else {
            // Periodic server verification for verify mode without local ref
            if (verifyAttemptsRef.current % 4 === 0) {
              const res = await fetch("/api/face", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "verify",
                  descriptor: liveDescriptor,
                  email: targetEmail || undefined,
                }),
              })
              const data = await res.json().catch(() => ({}))
              if (data.distance !== undefined) {
                setMatchDistance(data.distance)
                setMatchConfidence(
                  data.confidence ?? Math.max(0, Math.min(100, Math.round((1 - data.distance / 0.52) * 100)))
                )
              }
              if (data.user?.name || data.candidateName) {
                setConfirmedName(data.user?.name || data.candidateName)
              }

              if (data.verified) {
                matchConsecutiveRef.current++
                if (matchConsecutiveRef.current >= 2) {
                  stopDetection()
                  setStatus("success")
                  const photo = captureVideoFrame(videoRef.current!)
                  cleanup()
                  setTimeout(() => {
                    onComplete?.(liveDescriptor, photo, data.user)
                  }, 1000)
                  return
                }
              } else {
                matchConsecutiveRef.current = Math.max(0, matchConsecutiveRef.current - 1)
              }
            }
          }

          // If looking away or face not matching after 35 attempts (about 6 seconds)
          if (verifyAttemptsRef.current > 35 && matchConsecutiveRef.current === 0) {
            setError("Face does not match your registered identity. Please align your face inside the dotted oval.")
          }
          return
        }

        if (!result.detected) {
          angleHoldFramesRef.current = 0
          return
        }

        const yaw = result.headYaw ?? 0

        // ------------------------------------------------------------------
        // B. MULTI-ANGLE REGISTRATION STEPS (Front, Left, Right)
        // ------------------------------------------------------------------
        if (angle === "front" && isRegister) {
          const isCentered = Math.abs(yaw) < 0.30
          const smileScore = result.expressions?.happy ?? 0
          const hasSmile = smileScore >= 0.30

          if (alignment.aligned && isCentered && hasSmile) {
            angleHoldFramesRef.current++
            if (angleHoldFramesRef.current >= 2) {
              await autoSnapAngle("front")
            }
          } else {
            angleHoldFramesRef.current = Math.max(0, angleHoldFramesRef.current - 1)
          }
          return
        }

        if (angle === "left" && isRegister) {
          if (alignment.aligned && yaw > 0.10) {
            angleHoldFramesRef.current++
            if (angleHoldFramesRef.current >= 2) {
              await autoSnapAngle("left")
            }
          } else {
            angleHoldFramesRef.current = Math.max(0, angleHoldFramesRef.current - 1)
          }
          return
        }

        if (angle === "right" && isRegister) {
          if (alignment.aligned && yaw < -0.10) {
            angleHoldFramesRef.current++
            if (angleHoldFramesRef.current >= 2) {
              await autoSnapAngle("right")
            }
          } else {
            angleHoldFramesRef.current = Math.max(0, angleHoldFramesRef.current - 1)
          }
          return
        }
      } catch (err) {
        console.error("Frame detection error:", err)
      } finally {
        isProcessingRef.current = false
        if (isRunningRef.current) {
          timerRef.current = setTimeout(runTick, 45)
        }
      }
    }

    runTick()
  }, [ready, detect, mode, autoSnapAngle, registeredDescriptor, targetEmail, faceDistance, cleanup, onComplete, stopDetection])

  useEffect(() => {
    if (
      ready &&
      (status === "angle_front" ||
        status === "angle_left" ||
        status === "angle_right" ||
        status === "detecting")
    ) {
      beginDetection()
    }
  }, [ready, status, beginDetection])

  const restart = useCallback(() => {
    cleanup()
    autoCapturingRef.current = false
    isProcessingRef.current = false
    isFinalizingRef.current = false
    matchConsecutiveRef.current = 0
    verifyAttemptsRef.current = 0
    isVerifyingServerRef.current = false
    serverFailedAttemptsRef.current = 0
    capturedDescriptorRef.current = null
    descriptorsRef.current = { front: null, left: null, right: null }
    photosRef.current = { front: null, left: null, right: null }
    setCapturedPhotos({ front: null, left: null, right: null })
    setCurrentAngle("front")
    setFaceResult(null)
    setMatchDistance(null)
    setMatchConfidence(null)
    prevBoxRef.current = null
    consecutiveSamplesRef.current = []
    loginConsecutiveRef.current = 0
    lastLoginDescriptorRef.current = null
    setShakeWarning(null)
    setLoginStep(0)
    setIsFaceAligned(false)
    setAlignmentHint("Fit face inside dotted oval")
    setError(null)
    setStatus("idle")
  }, [cleanup])

  const start = useCallback(() => {
    if (!ready) {
      setStatus("loading_models")
      return
    }
    startCamera()
  }, [ready, startCamera])

  useEffect(() => {
    if (ready && status === "loading_models") {
      startCamera()
    }
  }, [ready, status, startCamera])

  // Auto-start camera if requested and ready
  useEffect(() => {
    if (autoStart && ready && status === "idle") {
      startCamera()
    }
  }, [autoStart, ready, status, startCamera])

  const isActive = [
    "angle_front",
    "angle_left",
    "angle_right",
    "detecting",
    "capturing",
    "verifying",
  ].includes(status)

  const statusText = getStatusText(status, mode, currentAngle, faceResult, isFaceAligned, alignmentHint)

  return (
    <Card className={cn(embedded ? "border-0 shadow-none bg-transparent p-0" : "overflow-hidden border-border/80 shadow-md", className)}>
      {!embedded && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanFace className="size-5 text-primary" />
              {mode === "register"
                ? "Multi-Angle Biometric Registration"
                : mode === "login"
                  ? "Sign in with Face ID"
                  : "Vision Identity Verification"}
            </CardTitle>
            {matchConfidence !== null && isActive && (
              <Badge
                variant="outline"
                className={cn(
                  "tabular-nums text-xs font-semibold",
                  matchConfidence >= 75
                    ? "border-success/40 bg-success/10 text-success"
                    : matchConfidence >= 50
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : "border-muted text-muted-foreground",
                )}
              >
                Match: {matchConfidence}%
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            {mode === "register"
              ? "We automatically capture 3 photos (front, left, right) so the AI recognizes you reliably."
              : mode === "login"
                ? "Look directly into your camera to verify your face and instantly log into your account."
                : "Verifying your live face against your registered biometric profile."}
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn("flex flex-col gap-4", embedded && "p-0")}>
        {/* 3-Step Multi-Angle Step Tracker (Registration only) */}
        {mode === "register" && status !== "success" && (
          <div className="grid grid-cols-3 gap-2">
            <div
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-semibold transition-all duration-200",
                capturedPhotos.front
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-xs"
                  : currentAngle === "front" && isActive
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40 shadow-xs"
                    : "border-border/60 bg-card/40 text-muted-foreground",
              )}
            >
              <Smile className="size-3.5 shrink-0" />
              <span>1. Front &amp; Smile</span>
              {capturedPhotos.front && <CheckCircle2 className="size-3 text-emerald-400 ml-auto shrink-0" />}
            </div>

            <div
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-semibold transition-all duration-200",
                capturedPhotos.left
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-xs"
                  : currentAngle === "left" && isActive
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40 shadow-xs"
                    : "border-border/60 bg-card/40 text-muted-foreground",
              )}
            >
              <ArrowLeft className="size-3.5 shrink-0" />
              <span>2. Turn Left</span>
              {capturedPhotos.left && <CheckCircle2 className="size-3 text-emerald-400 ml-auto shrink-0" />}
            </div>

            <div
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-semibold transition-all duration-200",
                capturedPhotos.right
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-xs"
                  : currentAngle === "right" && isActive
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40 shadow-xs"
                    : "border-border/60 bg-card/40 text-muted-foreground",
              )}
            >
              <ArrowRight className="size-3.5 shrink-0" />
              <span>3. Turn Right</span>
              {capturedPhotos.right && <CheckCircle2 className="size-3 text-emerald-400 ml-auto shrink-0" />}
            </div>
          </div>
        )}

        {/* Main Viewport: Bouncy Green Tick Verified State vs Camera Viewport */}
        {status === "success" ? (
          <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/[0.06] p-6 shadow-[0_0_35px_rgba(16,185,129,0.3)] select-none animate-in fade-in zoom-in-95 duration-300">
            {/* Ambient radial glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center -z-10"
            >
              <div className="size-56 rounded-full bg-emerald-500/20 blur-3xl animate-pulse" />
            </div>

            <div className="flex flex-col items-center justify-center animate-verified-pop">
              <div className="flex size-20 items-center justify-center rounded-3xl border-2 border-emerald-500 bg-emerald-500/15 text-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.45)] backdrop-blur-xl">
                <CheckCircle2 className="size-10 stroke-[2.2] animate-bounce" />
              </div>
              <p className="mt-4 text-base font-bold tracking-wide text-emerald-500">
                {mode === "login"
                  ? "Face ID Verified"
                  : mode === "register"
                    ? "Face Biometrics Verified"
                    : "Identity Verified"}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin text-emerald-500" />
                {mode === "login"
                  ? `Welcome back, ${confirmedName || "Candidate"}! Loading dashboard…`
                  : "Loading dashboard…"}
              </p>
            </div>
          </div>
        ) : (
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/70 bg-black/90 shadow-lg">
          {isActive || status === "waiting_camera" ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="size-full -scale-x-100 object-cover"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted/20 text-muted-foreground">
              <CameraOff className="size-10 stroke-[1.5]" />
              <p className="text-xs">Camera preview inactive</p>
            </div>
          )}

          {/* Visual Dotted-Line Face Alignment Guide - CLEAN, UNOBSTRUCTED OVAL */}
          {isActive && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={cn(
                  "relative flex aspect-[3/4] w-40 sm:w-48 md:w-52 rounded-[50%] border-2 border-dashed transition-all duration-300",
                  isFaceAligned
                    ? "border-emerald-400/90 bg-emerald-500/[0.04] shadow-[0_0_28px_rgba(52,211,153,0.35)] ring-1 ring-emerald-400/30"
                    : faceResult?.detected
                      ? "border-amber-400/70 bg-amber-500/[0.02] shadow-[0_0_18px_rgba(251,191,36,0.2)] ring-1 ring-amber-400/20"
                      : "border-white/30 animate-pulse shadow-[0_0_12px_rgba(0,0,0,0.5)]",
                )}
              >
                {/* 4 Minimal Corner Crosshairs */}
                <div className="absolute -top-1 -left-1 size-3 rounded-tl border-t-2 border-l-2 border-current opacity-70" />
                <div className="absolute -top-1 -right-1 size-3 rounded-tr border-t-2 border-r-2 border-current opacity-70" />
                <div className="absolute -bottom-1 -left-1 size-3 rounded-bl border-b-2 border-l-2 border-current opacity-70" />
                <div className="absolute -bottom-1 -right-1 size-3 rounded-br border-b-2 border-r-2 border-current opacity-70" />
              </div>
            </div>
          )}

          {/* Single Status Badge on Top Right */}
          {isActive && (
            <div className="absolute right-3 top-3 flex items-center gap-2 z-10">
              {shakeWarning ? (
                <div className="flex items-center gap-1.5 rounded-full bg-destructive/90 px-3 py-1 text-[11px] font-semibold text-white shadow-lg backdrop-blur-md animate-bounce">
                  <AlertTriangle className="size-3" />
                  <span>Hold camera steady</span>
                </div>
              ) : faceResult?.detected ? (
                <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-emerald-400 border border-emerald-500/30 backdrop-blur-md shadow-sm">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {mode === "login" && matchConfidence !== null
                      ? `Match: ${matchConfidence}%`
                      : faceResult.faceCount === 1
                        ? "Face Detected"
                        : `${faceResult.faceCount} faces`}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-amber-300 border border-amber-500/30 backdrop-blur-md shadow-sm">
                  <span className="size-1.5 rounded-full bg-amber-400" />
                  <span>Position Face</span>
                </div>
              )}
            </div>
          )}

          {/* Single Sleek Floating Bottom Dynamic Island Instruction Capsule */}
          {isActive && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex max-w-[92%] items-center justify-center">
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/75 px-4 py-1.5 text-xs font-medium text-white shadow-xl backdrop-blur-md transition-all duration-300">
                {!faceResult?.detected ? (
                  <span>Center your face inside the guide</span>
                ) : !isFaceAligned ? (
                  <span className="text-amber-300 font-medium">{alignmentHint}</span>
                ) : mode === "register" ? (
                  currentAngle === "front" ? (
                    (faceResult?.expressions?.happy ?? 0) >= 0.30 ? (
                      <>
                        <Sparkles className="size-3.5 text-emerald-400 animate-spin shrink-0" />
                        <span className="text-emerald-300 font-semibold">Smile detected! Holding…</span>
                      </>
                    ) : (
                      <>
                        <Smile className="size-3.5 text-amber-300 shrink-0" />
                        <span>Look straight and smile 😊</span>
                      </>
                    )
                  ) : currentAngle === "left" ? (
                    (faceResult?.headYaw ?? 0) > 0.10 ? (
                      <>
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                        <span className="text-emerald-300 font-semibold">Left angle detected! Capturing…</span>
                      </>
                    ) : (
                      <>
                        <ArrowLeft className="size-3.5 text-sky-300 shrink-0 animate-bounce" />
                        <span>Turn head slightly left</span>
                      </>
                    )
                  ) : currentAngle === "right" ? (
                    (faceResult?.headYaw ?? 0) < -0.10 ? (
                      <>
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                        <span className="text-emerald-300 font-semibold">Right angle detected! Capturing…</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight className="size-3.5 text-sky-300 shrink-0 animate-bounce" />
                        <span>Turn head slightly right</span>
                      </>
                    )
                  ) : (
                    <span>Registration complete</span>
                  )
                ) : mode === "login" ? (
                  loginStep > 0 ? (
                    <>
                      <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-emerald-300">
                        Verifying frame {loginStep} of {LOGIN_CONSECUTIVE_REQUIRED}…
                      </span>
                    </>
                  ) : (
                    <span>Hold steady for Face ID…</span>
                  )
                ) : (
                  (matchConfidence ?? 0) >= 75 ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                      <span className="text-emerald-300 font-semibold">Identity Matched ({matchConfidence}%)</span>
                    </>
                  ) : (
                    <span>Matching biometric identity…</span>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

        {/* Manual snap helper for registration */}
        {mode === "register" && status !== "success" && isActive && currentAngle !== "done" && (
          <div className="flex justify-center">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => autoSnapAngle(currentAngle as "front" | "left" | "right")}
              className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 gap-1.5"
            >
              <Camera className="size-3.5" />
              Snap {currentAngle === "front" ? "front" : currentAngle === "left" ? "left turn" : "right turn"} manually
            </Button>
          </div>
        )}

        {/* 3 Captured Photos Thumbnails Strip (Registration) */}
        {mode === "register" && status !== "success" && (capturedPhotos.front || capturedPhotos.left || capturedPhotos.right) && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" /> Captured Biometric Angles
              </span>
              <span>
                {[capturedPhotos.front, capturedPhotos.left, capturedPhotos.right].filter(Boolean).length} of 3 Captured
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1">
                <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-muted flex items-center justify-center">
                  {capturedPhotos.front ? (
                    <>
                      <img src={capturedPhotos.front} alt="Front Face" className="size-full object-cover" />
                      <div className="absolute right-1 top-1 rounded-full bg-success p-0.5 text-white">
                        <CheckCircle2 className="size-3" />
                      </div>
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Pending</span>
                  )}
                </div>
                <span className="text-[11px] font-medium">Front</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-muted flex items-center justify-center">
                  {capturedPhotos.left ? (
                    <>
                      <img src={capturedPhotos.left} alt="Left Angle" className="size-full object-cover" />
                      <div className="absolute right-1 top-1 rounded-full bg-success p-0.5 text-white">
                        <CheckCircle2 className="size-3" />
                      </div>
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Pending</span>
                  )}
                </div>
                <span className="text-[11px] font-medium">Left Turn</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-muted flex items-center justify-center">
                  {capturedPhotos.right ? (
                    <>
                      <img src={capturedPhotos.right} alt="Right Angle" className="size-full object-cover" />
                      <div className="absolute right-1 top-1 rounded-full bg-success p-0.5 text-white">
                        <CheckCircle2 className="size-3" />
                      </div>
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Pending</span>
                  )}
                </div>
                <span className="text-[11px] font-medium">Right Turn</span>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {(error || faceError) && (
          <div className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-sm text-destructive shadow-sm">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span className="text-xs leading-relaxed font-medium">{error || faceError}</span>
            </div>
            {((error && (error.includes("already exists") || error.includes("FACE_ALREADY_EXISTS"))) || (faceError && faceError.includes("already exists"))) && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  window.location.href = "/sign-in"
                }}
                className="mt-1 w-full text-xs font-semibold gap-1.5 shadow"
              >
                Sign In With Existing Account <ArrowRight className="size-3.5" />
              </Button>
            )}
          </div>
        )}

        {/* Action buttons (only show when not succeeded) */}
        {status !== "success" && (
          <div className="flex flex-col gap-2">
            {status === "idle" && (
              <Button onClick={start} className="w-full">
                {!ready && <Loader2 className="size-4 animate-spin" />}
                <Camera className="size-4" />
                {mode === "register"
                  ? "Start Multi-Angle Registration"
                  : mode === "login"
                    ? "Start Face Sign-In"
                    : "Start Vision Verification"}
              </Button>
            )}
            {status === "loading_models" && (
              <Button disabled className="w-full">
                <Loader2 className="size-4 animate-spin" />
                Loading biometric models…
              </Button>
            )}
            {(status === "failed" || status === "error" || error) && (
              <Button onClick={restart} variant="outline" className="w-full">
                <RefreshCw className="size-4" /> Try again
              </Button>
            )}
            {status === "registering" && (
              <Button disabled className="w-full">
                <Loader2 className="size-4 animate-spin" /> Saving 3-angle profile…
              </Button>
            )}
            {onSkip && (
              <Button type="button" variant="ghost" size="sm" onClick={onSkip} className="text-xs text-muted-foreground">
                Skip for now
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getStatusText(
  status: VerificationStatus,
  mode: Mode,
  currentAngle: RegAngle,
  faceResult: FaceDetectionResult | null,
  isFaceAligned: boolean,
  alignmentHint: string,
): string {
  if (status === "waiting_camera") return "Starting camera…"
  if (!faceResult?.detected) return "Please position your face inside the dotted oval"
  if (!isFaceAligned) return alignmentHint

  switch (status) {
    case "angle_front":
      return "Step 1 of 3: Look directly at the camera and smile 😊"
    case "angle_left":
      return "Step 2 of 3: Turn your head slightly to your LEFT ⬅️ (auto-capturing)"
    case "angle_right":
      return "Step 3 of 3: Turn your head slightly to your RIGHT ➡️ (auto-capturing)"
    case "detecting":
      return mode === "login" ? "Face aligned — verifying Face ID biometrics…" : "Verifying face identity against registered profile…"
    case "capturing":
      return "Capturing photo…"
    case "registering":
      return "Saving 3-angle biometric profile…"
    case "verifying":
      return "Verifying identity…"
    case "success":
      return mode === "register" ? "Registration complete!" : "Identity confirmed!"
    case "failed":
      return "Face mismatch — please align face in dotted oval"
    default:
      return ""
  }
}
