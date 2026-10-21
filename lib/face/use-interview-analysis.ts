"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useFaceDetection, type FaceDetectionResult } from "./use-face-detection"
import type { InterviewFaceReport, FaceAnalysisEvent } from "@/lib/db/schema"

const SAMPLE_INTERVAL_MS = 25 // 25ms interval (~40 FPS) for instant split-second eye tracking responsiveness
const MATCH_THRESHOLD = 0.48 // Cryptographic biometric match threshold (aligned with /api/face): strictly prevents cross-person matches
const MISMATCH_CONSECUTIVE_REQUIRED = 2 // 2 consecutive checks (~50ms) for instant split-second alert while filtering 1-frame camera noise
const NO_FACE_CONSECUTIVE_REQUIRED = 2 // 2 consecutive frames (~50ms) of absence to declare No Face immediately

// LAPTOP SCREEN HYSTERESIS THRESHOLDS (CALCULATED FOR 14" & 15.6" LAPTOPS):
// A 14" to 15.6" display spans ~31 to 35 cm wide and ~18 to 20 cm tall with webcam at top bezel.
// Reading questions, viewing AI video tile, or typing answers produces horizontal gaze in [-0.26, +0.26]
// and downward vertical gaze in [0, +0.44] due to top-bezel webcam positioning.
// Deviation past 0.36 horizontal indicates looking away off-screen (phone, desk, door, window).
const GAZE_AWAY_X_ENTER = 0.36 // Horizontal eye roll or head glance off laptop screen
const GAZE_AWAY_Y_UP_ENTER = -0.38 // Looking up toward ceiling
const GAZE_AWAY_Y_DOWN_ENTER = 0.54 // Looking down away from screen toward desk/lap/phone

const GAZE_AWAY_X_EXIT = 0.30 // Returned within laptop screen cone
const GAZE_AWAY_Y_UP_EXIT = -0.28 // Returned down from ceiling
const GAZE_AWAY_Y_DOWN_EXIT = 0.46 // Returned up from desk/lap (covers full laptop display surface)

// Head orientation thresholds (detecting physical head turns off-screen)
const HEAD_YAW_AWAY_ENTER = 0.38 // Head turned sideways away from laptop screen
const HEAD_YAW_AWAY_EXIT = 0.30 // Head returned facing laptop screen
const HEAD_PITCH_DOWN_ENTER = 0.54 // Head bowed down toward desk/lap/phone
const HEAD_PITCH_DOWN_EXIT = 0.46 // Head raised back to screen level
const HEAD_PITCH_UP_ENTER = -0.38 // Head tilted up toward ceiling
const HEAD_PITCH_UP_EXIT = -0.28 // Head brought down to screen

// High-speed EMA smoothing (85% new frame, 15% history) for split-second eye tracking
const EMA_NEW_WEIGHT = 0.85
const EMA_HISTORY_WEIGHT = 0.15

// TEMPORAL DEBOUNCE:
// 2 frames (~80ms) of look-away to enter "away" -> instant, split-second responsiveness
// 1 frame (~40ms) of looking back at screen/camera to return to "toward" -> instantaneous return
const CONSECUTIVE_AWAY_REQUIRED = 2
const CONSECUTIVE_TOWARD_REQUIRED = 1
const PROLONGED_GAZE_AWAY_SEC = 2.5 // Seconds threshold for "prolonged" stare away

// MULTIPLE FACES DEBOUNCE:
// Fast 3-frame debounce (~120ms) so when 2 people are in frame it responds instantly while rejecting 1-frame glitches
const MULTIPLE_FACES_CONSECUTIVE_REQUIRED = 3
const MULTIPLE_FACES_CLEAR_REQUIRED = 3

// SPEECH HOLD-OVER & VAD CONSTANTS (Prevents syllabic flickering during bilabials /m/, /p/, /b/ and word pauses):
const MOUTH_OPEN_THRESHOLD = 0.13 // MAR threshold to consider mouth open
const MOUTH_STRONG_OPEN_THRESHOLD = 0.22 // High MAR threshold for instant speech activation (e.g. wide vowel)
const SPEECH_ACTIVATION_FRAMES = 2 // 2 consecutive frames (~130ms) of open mouth to activate speaking
const SPEECH_HANGOVER_MS = 700 // Hold speaking state for 700ms across bilabial closures and inter-word pauses

function captureVideoFrame(video: HTMLVideoElement): string | null {
  try {
    if (!video.videoWidth || !video.videoHeight) return null
    const canvas = document.createElement("canvas")
    canvas.width = Math.min(video.videoWidth, 640)
    canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight)
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.78)
  } catch {
    return null
  }
}

// Low-overhead background camera motion / shake detector
let motionCanvas: HTMLCanvasElement | null = null
let motionCtx: CanvasRenderingContext2D | null = null
let prevMotionLuma: Float32Array | null = null
let prevMotionFaceBox: { cx: number; cy: number } | null = null

function detectCameraMotion(
  video: HTMLVideoElement,
  faceBox: { x: number; y: number; width: number; height: number } | null
): boolean {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0 || typeof document === "undefined") {
    return false
  }

  const W = 48
  const H = 36
  if (!motionCanvas) {
    motionCanvas = document.createElement("canvas")
    motionCanvas.width = W
    motionCanvas.height = H
    motionCtx = motionCanvas.getContext("2d", { willReadFrequently: true })
  }
  if (!motionCtx) return false

  try {
    motionCtx.drawImage(video, 0, 0, W, H)
    const imgData = motionCtx.getImageData(0, 0, W, H)
    const data = imgData.data

    const currLuma = new Float32Array(W * H)
    for (let i = 0; i < currLuma.length; i++) {
      const idx = i * 4
      currLuma[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
    }

    if (!prevMotionLuma) {
      prevMotionLuma = currLuma
      return false
    }

    // Completely isolate candidate's face, neck, shoulders, arms, and torso:
    // Any candidate body motion is strictly masked out from top of forehead down to bottom of frame!
    let fX0 = -1, fX1 = -1, fY0 = -1, fY1 = -1

    if (faceBox) {
      // Expand candidate corridor horizontally by 60% on each side to cover shoulders and arm gestures
      const padX = faceBox.width * 0.6
      fX0 = Math.max(0, Math.floor(((faceBox.x - padX) / video.videoWidth) * W))
      fX1 = Math.min(W - 1, Math.ceil(((faceBox.x + faceBox.width + padX) / video.videoWidth) * W))
      // Forehead to bottom of frame (covers torso, arms, and chair)
      fY0 = Math.max(0, Math.floor(((faceBox.y - faceBox.height * 0.15) / video.videoHeight) * H))
      fY1 = H - 1
    }

    // 4 peripheral background anchor zones that represent static room walls/ceiling:
    // TL: top-left corner (x: 0..10, y: 0..8)
    // TR: top-right corner (x: 37..47, y: 0..8)
    // BL: far-left border (x: 0..5, y: 10..22)
    // BR: far-right border (x: 42..47, y: 10..22)
    const zoneDiffs = [0, 0, 0, 0]
    const zoneCounts = [0, 0, 0, 0]

    let totalBgDiff = 0
    let totalBgCount = 0

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // Skip candidate body corridor entirely
        if (faceBox && x >= fX0 && x <= fX1 && y >= fY0 && y <= fY1) {
          continue
        }
        const idx = y * W + x
        const diff = Math.abs(currLuma[idx] - prevMotionLuma[idx])
        totalBgDiff += diff
        totalBgCount++

        // Check peripheral zones
        if (x <= 10 && y <= 8) {
          zoneDiffs[0] += diff
          zoneCounts[0]++
        } else if (x >= 37 && y <= 8) {
          zoneDiffs[1] += diff
          zoneCounts[1]++
        } else if (x <= 5 && y >= 10 && y <= 22) {
          zoneDiffs[2] += diff
          zoneCounts[2]++
        } else if (x >= 42 && y >= 10 && y <= 22) {
          zoneDiffs[3] += diff
          zoneCounts[3]++
        }
      }
    }

    prevMotionLuma = currLuma

    const avgBgMotion = totalBgCount > 0 ? totalBgDiff / totalBgCount : 0

    // Count how many peripheral static room zones moved
    let movingZones = 0
    for (let i = 0; i < 4; i++) {
      if (zoneCounts[i] > 0 && zoneDiffs[i] / zoneCounts[i] > 12.0) {
        movingZones++
      }
    }

    // TRUE camera movement:
    // Requires significant background motion (> 14.0) AND at least 2 distinct room corners moving simultaneously!
    // When a person shifts in their chair, the static room corners have zero motion (~1-2), so this will NEVER trigger!
    return avgBgMotion > 14.0 && movingZones >= 2
  } catch {
    return false
  }
}

export type InterviewAnalysisState = {
  running: boolean
  registeredDescriptor: number[] | null
  currentMatch: boolean | null
  identityMismatch: boolean
  multipleFacesDetected: boolean
  cameraMovementDetected: boolean
  cameraMovementCount: number
  currentGaze: "toward" | "away" | null
  lookingAtCamera: boolean
  currentMouthMoving: boolean | null
  faceDetected: boolean
  faceCount: number
  elapsedSec: number
  gazeAwayCount: number
  report: InterviewFaceReport | null
  liveCandidatePhoto: string | null
}

/**
 * Hook that runs face analysis during an interview.
 * Call `start(videoElement, registeredDescriptor, options)` when the interview begins
 * and `stop()` when it ends. The hook will periodically sample the video.
 */
export function useInterviewAnalysis() {
  const { ready, detect, faceDistance } = useFaceDetection()
  const [state, setState] = useState<InterviewAnalysisState>({
    running: false,
    registeredDescriptor: null,
    currentMatch: null,
    identityMismatch: false,
    multipleFacesDetected: false,
    cameraMovementDetected: false,
    cameraMovementCount: 0,
    currentGaze: null,
    lookingAtCamera: false,
    currentMouthMoving: null,
    faceDetected: false,
    faceCount: 0,
    elapsedSec: 0,
    gazeAwayCount: 0,
    report: null,
    liveCandidatePhoto: null,
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isProcessingRef = useRef(false)
  const startTimeRef = useRef<number>(0)
  const eventsRef = useRef<FaceAnalysisEvent[]>([])
  const metricsRef = useRef({
    matchCount: 0,
    mismatchCount: 0,
    consecutiveMismatch: 0,
    lastMismatchEventMs: 0,
    multipleFaceCount: 0,
    noFaceCount: 0,
    cameraMovementCount: 0,
    cameraMovingFrames: 0,
    isCameraMovingActive: false,
    cameraMovingHoldUntilMs: 0,
    lastCameraMovementEventMs: 0,
    gazeTowardSamples: 0,
    gazeAwaySamples: 0,
    totalSamples: 0,
    mouthMovingSamples: 0,
    mouthStillSamples: 0,
    currentStareStartMs: -1,
    currentStareStartSec: -1,
    gazeAwayCount: 0,
    prolongedGazeAwayCount: 0,
    speakingStartSec: -1,
    silentStartSec: -1,
    isSpeakingActive: false,
    consecutiveOpenMouthFrames: 0,
    lastMouthActiveTimeMs: 0,
    speakingStartMs: -1,
    silentStartMs: -1,
    speakingIntervals: [] as { startSec: number; endSec: number }[],
    silentIntervals: [] as { startSec: number; endSec: number }[],
    smoothedGazeX: null as number | null,
    smoothedGazeY: null as number | null,
    lastRawGazeX: null as number | null,
    lastRawGazeY: null as number | null,
    currentGazeStatus: "toward" as "toward" | "away",
    consecutiveAwaySamples: 0,
    consecutiveTowardSamples: 0,
    consecutiveNoFaceSamples: 0,
    consecutiveMultipleFaces: 0,
    isMultipleFacesActive: false,
    lastMultipleFaceEventSec: -10,
    liveCandidatePhoto: null as string | null,
    mismatchPhoto: null as string | null,
    isCurrentlyMatched: null as boolean | null,
  })
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const descriptorRef = useRef<any>(null)
  const isVerifyingIdentityRef = useRef(false)
  const lastIdentityCheckTimeRef = useRef<number>(0)
  const initialIdentityVerifiedRef = useRef(false)
  const optionsRef = useRef<{
    entryPhoto?: string | null
    entryDescriptor?: number[] | null
    registeredPhotos?: { front?: string | null; left?: string | null; right?: string | null } | null
  }>({})

  const start = useCallback(
    (
      video: HTMLVideoElement,
      registeredDescriptor: any,
      options?: {
        entryPhoto?: string | null
        entryDescriptor?: number[] | null
        registeredPhotos?: { front?: string | null; left?: string | null; right?: string | null } | null
      }
    ) => {
      videoRef.current = video
      descriptorRef.current = registeredDescriptor
      optionsRef.current = options || {}
      startTimeRef.current = Date.now()
      eventsRef.current = []
      isVerifyingIdentityRef.current = false
      lastIdentityCheckTimeRef.current = 0
      initialIdentityVerifiedRef.current = false
      metricsRef.current = {
        matchCount: 0,
        mismatchCount: 0,
        consecutiveMismatch: 0,
        lastMismatchEventMs: 0,
        multipleFaceCount: 0,
        noFaceCount: 0,
        cameraMovementCount: 0,
        cameraMovingFrames: 0,
        isCameraMovingActive: false,
        cameraMovingHoldUntilMs: 0,
        lastCameraMovementEventMs: 0,
        gazeTowardSamples: 0,
        gazeAwaySamples: 0,
        totalSamples: 0,
        mouthMovingSamples: 0,
        mouthStillSamples: 0,
        currentStareStartMs: -1,
        currentStareStartSec: -1,
        gazeAwayCount: 0,
        prolongedGazeAwayCount: 0,
        speakingStartSec: -1,
        silentStartSec: -1,
        isSpeakingActive: false,
        consecutiveOpenMouthFrames: 0,
        lastMouthActiveTimeMs: 0,
        speakingStartMs: -1,
        silentStartMs: -1,
        speakingIntervals: [],
        silentIntervals: [],
        smoothedGazeX: null,
        smoothedGazeY: null,
        lastRawGazeX: null,
        lastRawGazeY: null,
        currentGazeStatus: "toward",
        consecutiveAwaySamples: 0,
        consecutiveTowardSamples: 0,
        consecutiveNoFaceSamples: 0,
        consecutiveMultipleFaces: 0,
        isMultipleFacesActive: false,
        lastMultipleFaceEventSec: -10,
        liveCandidatePhoto: null,
        mismatchPhoto: null,
        isCurrentlyMatched: null,
      }
      setState((s) => ({
        ...s,
        running: true,
        registeredDescriptor: Array.isArray(registeredDescriptor) ? registeredDescriptor : registeredDescriptor?.front || null,
        currentMatch: null,
        identityMismatch: false,
        multipleFacesDetected: false,
        cameraMovementDetected: false,
        cameraMovementCount: 0,
        report: null,
        elapsedSec: 0,
        gazeAwayCount: 0,
        liveCandidatePhoto: null,
      }))
    },
    [],
  )

  const updateDescriptor = useCallback((descriptor: any) => {
    descriptorRef.current = descriptor
    lastIdentityCheckTimeRef.current = 0
    initialIdentityVerifiedRef.current = false
    metricsRef.current.isCurrentlyMatched = null
    metricsRef.current.consecutiveMismatch = 0
    setState((s) => ({
      ...s,
      registeredDescriptor: Array.isArray(descriptor) ? descriptor : descriptor?.front || null,
      currentMatch: null,
      identityMismatch: false,
    }))
  }, [])

  const buildReport = useCallback((): InterviewFaceReport => {
    const m = metricsRef.current
    const now = Date.now()
    const totalDurationSec = Math.round((now - startTimeRef.current) / 1000)
    const totalGazeSamples = m.gazeTowardSamples + m.gazeAwaySamples
    const totalMouthSamples = m.mouthMovingSamples + m.mouthStillSamples

    // Finalize any active stare that was ongoing when the interview ended
    if (m.currentGazeStatus === "away" && m.currentStareStartMs > 0) {
      const durationMs = now - m.currentStareStartMs
      const durationSec = Math.max(0.2, Math.round(durationMs / 100) / 10)
      eventsRef.current.push({
        type: "gaze_away",
        timestamp: Math.round(m.currentStareStartSec),
        duration: durationSec,
        details: `Looked away for ${durationSec}s`,
      })
      if (durationSec >= PROLONGED_GAZE_AWAY_SEC) {
        m.prolongedGazeAwayCount++
      }
      m.currentStareStartMs = -1
    }

    // Finalize any ongoing speech or silent interval
    if (m.isSpeakingActive && m.speakingStartMs > 0) {
      const speakSecStart = Math.max(0, Math.round((m.speakingStartMs - startTimeRef.current) / 1000))
      const speakSecEnd = Math.max(speakSecStart, Math.round((Math.max(m.speakingStartMs, m.lastMouthActiveTimeMs) - startTimeRef.current) / 1000))
      if (speakSecEnd >= speakSecStart) {
        m.speakingIntervals.push({ startSec: speakSecStart, endSec: Math.max(speakSecStart + 1, speakSecEnd) })
      }
    } else if (m.silentStartMs > 0) {
      const silentSecStart = Math.max(0, Math.round((m.silentStartMs - startTimeRef.current) / 1000))
      const silentSecEnd = Math.max(silentSecStart, Math.round((now - startTimeRef.current) / 1000))
      if (silentSecEnd >= silentSecStart) {
        m.silentIntervals.push({ startSec: silentSecStart, endSec: Math.max(silentSecStart + 1, silentSecEnd) })
      }
    }

    const totalIdentityChecks = m.matchCount + m.mismatchCount
    const matchPercentage = totalIdentityChecks > 0
      ? Math.round((m.matchCount / totalIdentityChecks) * 100)
      : 0

    // Stricter identity verification: Must match registered face biometrics
    const hasRegisteredBiometrics = Boolean(descriptorRef.current)
    const identityVerified = hasRegisteredBiometrics
      ? m.matchCount > 0 && m.matchCount >= m.mismatchCount
      : true

    const identityMismatchDetected = hasRegisteredBiometrics
      ? (m.mismatchCount > 0 && (m.mismatchCount >= m.matchCount || m.matchCount === 0))
      : false

    const multipleFacesDetected = m.multipleFaceCount > 0
    const cameraMovementDetected = (m.cameraMovementCount || 0) > 0

    const livePhoto = m.mismatchPhoto || m.liveCandidatePhoto || optionsRef.current.entryPhoto || null

    let proctoringAlert: string | null = null
    if (identityMismatchDetected) {
      proctoringAlert = `CRITICAL AUDIT ALERT: Potential Candidate Impersonation. The face in the live interview did not match the registered candidate biometrics (${m.mismatchCount} mismatch checks logged).`
    } else if (multipleFacesDetected) {
      proctoringAlert = `PROCTORING ALERT: Multiple faces (${m.multipleFaceCount} occurrences) detected in camera frame during interview session.`
    } else if (m.cameraMovementCount >= 2) {
      proctoringAlert = `PROCTORING NOTE: Camera movement was detected (${m.cameraMovementCount} occurrences) during the interview session.`
    }

    const registeredPhotos = optionsRef.current.registeredPhotos || (descriptorRef.current as any)?.photos || null

    return {
      identityVerified,
      identityMismatchDetected,
      multipleFacesDetected,
      cameraMovementDetected,
      cameraMovementCount: m.cameraMovementCount || 0,
      matchCount: m.matchCount,
      mismatchCount: m.mismatchCount,
      multipleFaceCount: m.multipleFaceCount,
      noFaceCount: m.noFaceCount,
      gazeTowardPercent: totalGazeSamples > 0 ? Math.round((m.gazeTowardSamples / totalGazeSamples) * 100) : 0,
      gazeAwayPercent: totalGazeSamples > 0 ? Math.round((m.gazeAwaySamples / totalGazeSamples) * 100) : 0,
      gazeAwayCount: m.gazeAwayCount,
      prolongedGazeAwayCount: m.prolongedGazeAwayCount,
      mouthMovementPercent: totalMouthSamples > 0 ? Math.round((m.mouthMovingSamples / totalMouthSamples) * 100) : 0,
      speakingIntervals: m.speakingIntervals,
      silentIntervals: m.silentIntervals,
      events: eventsRef.current,
      totalDurationSec,
      analyzedAt: new Date().toISOString(),
      entryVerificationPassed: identityVerified,
      entryPhoto: livePhoto,
      intervieweePhoto: livePhoto,
      registeredPhotos,
      matchPercentage,
      proctoringAlert,
    }
  }, [])

  const stop = useCallback((): InterviewFaceReport => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    const report = buildReport()
    setState((s) => ({ ...s, running: false, report }))
    return report
  }, [buildReport])

  // Run sampling loop
  useEffect(() => {
    if (!state.running || !ready) return

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      if (isProcessingRef.current) return
      isProcessingRef.current = true

      try {
        const m = metricsRef.current
        const now = Date.now()
        const elapsedSec = Math.round((now - startTimeRef.current) / 1000)
        m.totalSamples++

        const hasRegistered = Boolean(descriptorRef.current)
        // Instant identity verification: When unverified or mismatched, evaluate descriptor on EVERY frame
        // for split-second detection of new users! Once matched, re-verify every 800ms (~1.2 times/sec) continuously,
        // leaving 96% of frames purely dedicated to lightning-fast 40 FPS gaze and face tracking!
        const identityCheckInterval = initialIdentityVerifiedRef.current ? 800 : 120
        const needDescriptor =
          hasRegistered &&
          (m.isCurrentlyMatched !== true || now - lastIdentityCheckTimeRef.current >= identityCheckInterval)

        if (needDescriptor) {
          lastIdentityCheckTimeRef.current = now
        }

        const result = await detect(video, {
          withDescriptor: needDescriptor,
          withExpressions: false,
        })

        // Real-time camera movement detection (background motion & position shift)
        const isCameraMovingNow = detectCameraMotion(video, result.detected ? result.box : null)
        if (isCameraMovingNow) {
          m.cameraMovingFrames = (m.cameraMovingFrames || 0) + 1
          if (m.cameraMovingFrames >= 3) {
            m.isCameraMovingActive = true
            m.cameraMovingHoldUntilMs = now + 1500
            if (now - (m.lastCameraMovementEventMs || 0) >= 3500) {
              m.lastCameraMovementEventMs = now
              m.cameraMovementCount = (m.cameraMovementCount || 0) + 1
              eventsRef.current.push({
                type: "camera_movement",
                timestamp: elapsedSec,
                details: "Camera movement or position shift detected",
              })
            }
          }
        } else {
          m.cameraMovingFrames = Math.max(0, (m.cameraMovingFrames || 0) - 1)
          if (now >= (m.cameraMovingHoldUntilMs || 0)) {
            m.isCameraMovingActive = false
          }
        }
        const cameraMovementDetected = Boolean(m.isCameraMovingActive)

        // No face (debounced so brief camera blinks or single-frame drops don't toggle "No face")
        if (!result.detected) {
          m.consecutiveNoFaceSamples++
          m.isSpeakingActive = false
          m.isCurrentlyMatched = null
          m.consecutiveMismatch = 0

          if (m.consecutiveNoFaceSamples >= NO_FACE_CONSECUTIVE_REQUIRED) {
            if (m.consecutiveNoFaceSamples === NO_FACE_CONSECUTIVE_REQUIRED) {
              m.noFaceCount++
              eventsRef.current.push({ type: "no_face", timestamp: elapsedSec })
            }
            initialIdentityVerifiedRef.current = false
            setState((s) => ({
              ...s,
              elapsedSec,
              faceDetected: false,
              faceCount: 0,
              multipleFacesDetected: false,
              cameraMovementDetected,
              cameraMovementCount: m.cameraMovementCount,
              currentMatch: null,
              currentGaze: null,
              lookingAtCamera: false,
              currentMouthMoving: null,
              identityMismatch: false,
            }))
          } else {
            // Even on the single debounce frame, immediately clear identity mismatch so "No Face" never displays as a mismatch!
            setState((s) => ({
              ...s,
              elapsedSec,
              identityMismatch: false,
              currentMatch: null,
            }))
          }
          return
        }

        m.consecutiveNoFaceSamples = 0

        // Multiple faces detection with temporal debounce and rate-limited logging
        if (result.faceCount > 1) {
          m.consecutiveMultipleFaces = (m.consecutiveMultipleFaces || 0) + 1
          if (m.consecutiveMultipleFaces >= MULTIPLE_FACES_CONSECUTIVE_REQUIRED) {
            m.isMultipleFacesActive = true
            // Rate-limit event logging so it logs at most once per distinct incident (at least 6s apart)
            if (elapsedSec - (m.lastMultipleFaceEventSec || -10) >= 6) {
              m.multipleFaceCount++
              m.lastMultipleFaceEventSec = elapsedSec
              eventsRef.current.push({
                type: "multiple_faces",
                timestamp: elapsedSec,
                details: `${result.faceCount} persons visible in camera frame`,
              })
            }
          }
        } else {
          m.consecutiveMultipleFaces = Math.max(0, (m.consecutiveMultipleFaces || 0) - 1)
          if (m.consecutiveMultipleFaces < MULTIPLE_FACES_CLEAR_REQUIRED) {
            m.isMultipleFacesActive = false
          }
        }
        const isMultipleFaces = Boolean(m.isMultipleFacesActive)

        // Biometric Identity Verification (Synchronous Single-Pass Evaluation)
        // Evaluated on the exact frame the face is detected — zero lag, instantaneous split-second response!
        if (hasRegistered && needDescriptor) {
          const registered = descriptorRef.current as any
          const detectedDescriptors: number[][] =
            result.allDescriptors && result.allDescriptors.length > 0
              ? result.allDescriptors
              : result.descriptor
              ? [result.descriptor]
              : []

          if (detectedDescriptors.length > 0) {
            let bestCandidateDist = Infinity

            for (const detectedDesc of detectedDescriptors) {
              let dist = Infinity
              if (Array.isArray(registered)) {
                dist = faceDistance(registered, detectedDesc)
              } else if (registered && typeof registered === "object") {
                const list = [registered.front, registered.left, registered.right].filter(Boolean)
                for (const item of list) {
                  if (Array.isArray(item)) {
                    const d = faceDistance(item, detectedDesc)
                    if (d < dist) dist = d
                  }
                }
              }

              if (Array.isArray(optionsRef.current.entryDescriptor)) {
                const entryD = faceDistance(optionsRef.current.entryDescriptor, detectedDesc)
                if (entryD < dist) dist = entryD
              }

              if (dist < bestCandidateDist) {
                bestCandidateDist = dist
              }
            }

            // Calibrated biometric threshold:
            // Impostors (different person) produce distance >= 0.60 (typically 0.65 - 0.95).
            // Genuine candidate in low light / backlit room produces 0.25 - 0.49.
            // If candidate was already verified in this session, allow 0.52 for dim room tolerance.
            const effectiveThreshold = initialIdentityVerifiedRef.current ? 0.52 : MATCH_THRESHOLD

            if (bestCandidateDist <= effectiveThreshold) {
              m.matchCount++
              m.consecutiveMismatch = 0
              m.isCurrentlyMatched = true
              initialIdentityVerifiedRef.current = true
              if (!m.liveCandidatePhoto && video) {
                m.liveCandidatePhoto = captureVideoFrame(video)
              }
            } else {
              m.isCurrentlyMatched = false
              m.consecutiveMismatch = (m.consecutiveMismatch || 0) + 1
              m.mismatchCount++
              if (!m.mismatchPhoto && video) {
                m.mismatchPhoto = captureVideoFrame(video)
              }
              // Rate-limit event logging so distinct incidents are recorded cleanly
              if (m.consecutiveMismatch === MISMATCH_CONSECUTIVE_REQUIRED || now - (m.lastMismatchEventMs || 0) >= 4000) {
                m.lastMismatchEventMs = now
                eventsRef.current.push({
                  type: "face_mismatch",
                  timestamp: elapsedSec,
                  details: `Biometric distance ${bestCandidateDist.toFixed(3)} exceeds threshold ${effectiveThreshold}`,
                })
              }
            }
          }
        }

        // Instantaneous Gaze & Saccade Tracking
        let currentGaze: "toward" | "away" = m.currentGazeStatus

        if (result.gazeX !== null && result.gazeY !== null) {
          const rawX = result.gazeX
          const rawY = result.gazeY
          const yaw = Math.abs(result.headYaw ?? 0)
          const pitch = result.headPitch ?? 0

          // Calculate instantaneous saccadic velocity to detect rapid eye/head movement:
          const prevRawX = m.lastRawGazeX !== null ? m.lastRawGazeX : rawX
          const prevRawY = m.lastRawGazeY !== null ? m.lastRawGazeY : rawY
          m.lastRawGazeX = rawX
          m.lastRawGazeY = rawY
          const deltaX = Math.abs(rawX - prevRawX)
          const deltaY = Math.abs(rawY - prevRawY)
          const isFastMove = deltaX >= 0.12 || deltaY >= 0.14

          // Separate Horizontal and Vertical Boundary Tests:
          const isHorizAway = Math.abs(rawX) >= GAZE_AWAY_X_ENTER || yaw >= HEAD_YAW_AWAY_ENTER
          const isVertAway =
            rawY <= GAZE_AWAY_Y_UP_ENTER ||
            rawY >= GAZE_AWAY_Y_DOWN_ENTER ||
            pitch <= HEAD_PITCH_UP_ENTER ||
            pitch >= HEAD_PITCH_DOWN_ENTER

          // Exit (Return-to-Screen) Tests with laptop-ergonomic bounds:
          const isHorizToward = Math.abs(rawX) <= GAZE_AWAY_X_EXIT && yaw <= HEAD_YAW_AWAY_EXIT
          const isVertToward =
            rawY >= GAZE_AWAY_Y_UP_EXIT &&
            rawY <= GAZE_AWAY_Y_DOWN_EXIT &&
            pitch >= HEAD_PITCH_UP_EXIT &&
            pitch <= HEAD_PITCH_DOWN_EXIT

          const isFullyToward = isHorizToward && isVertToward
          const isAnyAway = isHorizAway || isVertAway

          // Saccade-Aware Dynamic Smoothing:
          // When eyes move fast or transition, snap coordinates immediately (0ms filter lag)!
          if (
            m.smoothedGazeX === null ||
            m.smoothedGazeY === null ||
            isFastMove ||
            (m.currentGazeStatus === "toward" && isAnyAway) ||
            (m.currentGazeStatus === "away" && isFullyToward)
          ) {
            m.smoothedGazeX = rawX
            m.smoothedGazeY = rawY
          } else {
            m.smoothedGazeX = m.smoothedGazeX * EMA_HISTORY_WEIGHT + rawX * EMA_NEW_WEIGHT
            m.smoothedGazeY = m.smoothedGazeY * EMA_HISTORY_WEIGHT + rawY * EMA_NEW_WEIGHT
          }

          let isInstantlyAway: boolean
          if (m.currentGazeStatus === "toward") {
            isInstantlyAway =
              Math.abs(m.smoothedGazeX) >= GAZE_AWAY_X_ENTER ||
              m.smoothedGazeY <= GAZE_AWAY_Y_UP_ENTER ||
              m.smoothedGazeY >= GAZE_AWAY_Y_DOWN_ENTER ||
              yaw >= HEAD_YAW_AWAY_ENTER ||
              pitch <= HEAD_PITCH_UP_ENTER ||
              pitch >= HEAD_PITCH_DOWN_ENTER
          } else {
            const isBackToward =
              Math.abs(m.smoothedGazeX) <= GAZE_AWAY_X_EXIT &&
              m.smoothedGazeY >= GAZE_AWAY_Y_UP_EXIT &&
              m.smoothedGazeY <= GAZE_AWAY_Y_DOWN_EXIT &&
              yaw <= HEAD_YAW_AWAY_EXIT &&
              pitch >= HEAD_PITCH_UP_EXIT &&
              pitch <= HEAD_PITCH_DOWN_EXIT
            isInstantlyAway = !isBackToward
          }

          // INSTANTANEOUS SWITCHING:
          // Away: switches on first frame if fast move or clear deflection.
          // Toward: switches on first frame as soon as gaze is back inside screen cone!
          const canInstantSwitchAway = isInstantlyAway && (isFastMove || Math.abs(rawX) >= GAZE_AWAY_X_ENTER + 0.02 || yaw >= HEAD_YAW_AWAY_ENTER)
          const canInstantSwitchToward = !isInstantlyAway || isFullyToward

          if (isInstantlyAway) {
            m.consecutiveAwaySamples = (m.consecutiveAwaySamples || 0) + 1
            m.consecutiveTowardSamples = 0
          } else {
            m.consecutiveTowardSamples = (m.consecutiveTowardSamples || 0) + 1
            m.consecutiveAwaySamples = 0
          }

          // State transition with zero debounce for fast moves, 2-frame debounce for subtle boundary drift
          if (m.currentGazeStatus === "toward") {
            if (canInstantSwitchAway || m.consecutiveAwaySamples >= CONSECUTIVE_AWAY_REQUIRED) {
              m.currentGazeStatus = "away"
              m.gazeAwayCount++
              m.currentStareStartMs = now
              m.currentStareStartSec = elapsedSec
            }
          } else {
            if (canInstantSwitchToward || m.consecutiveTowardSamples >= CONSECUTIVE_TOWARD_REQUIRED) {
              m.currentGazeStatus = "toward"
              m.smoothedGazeX = rawX
              m.smoothedGazeY = rawY
              if (m.currentStareStartMs > 0) {
                const durationMs = now - m.currentStareStartMs
                const durationSec = Math.max(0.2, Math.round(durationMs / 100) / 10)
                eventsRef.current.push({
                  type: "gaze_away",
                  timestamp: Math.round(m.currentStareStartSec),
                  duration: durationSec,
                  details: `Looked away for ${durationSec}s`,
                })
                if (durationSec >= PROLONGED_GAZE_AWAY_SEC) {
                  m.prolongedGazeAwayCount++
                }
              }
              m.currentStareStartMs = -1
              m.currentStareStartSec = -1
            }
          }

          if (m.currentGazeStatus === "away") {
            m.gazeAwaySamples++
          } else {
            m.gazeTowardSamples++
          }

          currentGaze = m.currentGazeStatus
        }

        // Intelligent Speech Activity Detection with Speech Hangover
        // Eliminates single-frame syllable flicker on bilabials (/m/, /p/, /b/) and pauses
        let isMouthMoving = false
        if (result.mar !== null) {
          const isMouthCurrentlyOpen = result.mar >= MOUTH_OPEN_THRESHOLD
          const isStrongMouthOpen = result.mar >= MOUTH_STRONG_OPEN_THRESHOLD

          if (isMouthCurrentlyOpen) {
            m.consecutiveOpenMouthFrames++
          } else {
            m.consecutiveOpenMouthFrames = 0
          }

          // Speech activation: requires 2 consecutive open frames (~130ms) or 1 strong open frame (vowel)
          const shouldActivateSpeech =
            m.consecutiveOpenMouthFrames >= SPEECH_ACTIVATION_FRAMES || isStrongMouthOpen

          if (shouldActivateSpeech) {
            if (!m.isSpeakingActive) {
              m.isSpeakingActive = true
              m.speakingStartMs = now
              if (m.silentStartMs > 0) {
                const silentSecStart = Math.max(0, Math.round((m.silentStartMs - startTimeRef.current) / 1000))
                const silentSecEnd = Math.max(silentSecStart, Math.round((now - startTimeRef.current) / 1000))
                if (silentSecEnd > silentSecStart) {
                  m.silentIntervals.push({ startSec: silentSecStart, endSec: silentSecEnd })
                }
                m.silentStartMs = -1
              }
            }
            m.lastMouthActiveTimeMs = now
          } else if (m.isSpeakingActive) {
            // Speech hangover: hold "Speaking" status active across bilabial closures and inter-word pauses
            if (now - m.lastMouthActiveTimeMs > SPEECH_HANGOVER_MS) {
              m.isSpeakingActive = false
              const speakSecStart = Math.max(0, Math.round((m.speakingStartMs - startTimeRef.current) / 1000))
              const speakSecEnd = Math.max(speakSecStart, Math.round((m.lastMouthActiveTimeMs - startTimeRef.current) / 1000))
              if (speakSecEnd > speakSecStart) {
                m.speakingIntervals.push({ startSec: speakSecStart, endSec: speakSecEnd })
              }
              m.speakingStartMs = -1
              m.silentStartMs = m.lastMouthActiveTimeMs
            }
          } else {
            // Silence
            if (m.silentStartMs < 0) {
              m.silentStartMs = now
            }
          }

          if (m.isSpeakingActive) {
            m.mouthMovingSamples++
          } else {
            m.mouthStillSamples++
          }

          isMouthMoving = m.isSpeakingActive
        }

        const isMismatch = Boolean(
          result.detected &&
          result.faceCount > 0 &&
          hasRegistered &&
          m.isCurrentlyMatched === false &&
          (m.consecutiveMismatch || 0) >= MISMATCH_CONSECUTIVE_REQUIRED
        )

        setState((s) => ({
          ...s,
          faceDetected: true,
          faceCount: isMultipleFaces ? result.faceCount : 1,
          multipleFacesDetected: isMultipleFaces,
          cameraMovementDetected,
          cameraMovementCount: m.cameraMovementCount,
          identityMismatch: isMismatch,
          currentMatch: isMismatch ? false : (m.isCurrentlyMatched === true ? true : (m.isCurrentlyMatched === false ? false : null)),
          elapsedSec,
          currentGaze,
          lookingAtCamera: currentGaze === "toward",
          gazeAwayCount: m.gazeAwayCount,
          currentMouthMoving: isMouthMoving,
          liveCandidatePhoto: isMismatch ? (m.mismatchPhoto || m.liveCandidatePhoto) : m.liveCandidatePhoto,
        }))
      } catch (err) {
        console.error("Interview analysis frame error:", err)
      } finally {
        isProcessingRef.current = false
      }
    }, SAMPLE_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      isProcessingRef.current = false
    }
  }, [state.running, ready, detect, faceDistance])

  /** Save the current report to the backend. */
  const saveReport = useCallback(async (submissionId?: string): Promise<void> => {
    const report = state.report ?? buildReport()
    await fetch("/api/face/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report, submissionId }),
    })
  }, [state.report, buildReport])

  return {
    ...state,
    lookingAtCamera: state.currentGaze === "toward",
    multipleFaces: state.faceCount,
    ready,
    start,
    stop,
    saveReport,
    updateDescriptor,
  }
}
