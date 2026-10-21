"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Face detection result from a single frame analysis.
 */
export type FaceDetectionResult = {
  detected: boolean
  faceCount: number
  descriptor: number[] | null
  allDescriptors?: number[][]
  expressions: Record<string, number> | null
  landmarks: {
    leftEye: { x: number; y: number }[]
    rightEye: { x: number; y: number }[]
    nose: { x: number; y: number }[]
    mouth: { x: number; y: number }[]
    jawOutline: { x: number; y: number }[]
  } | null
  /** Eye Aspect Ratio — low values indicate a blink. */
  ear: number | null
  /** Direct vertical eye opening in pixels. */
  eyeHeight: number | null
  /** Mouth openness ratio. */
  mar: number | null
  /** Estimated horizontal gaze direction: -1 (left), 0 (center), 1 (right). */
  gazeX: number | null
  /** Estimated vertical gaze direction: -1 (up), 0 (center), 1 (down). */
  gazeY: number | null
  /** Estimated horizontal head rotation: negative (turned left), 0 (centered), positive (turned right). */
  headYaw: number | null
  /** Estimated vertical head tilt: negative (tilted up), 0 (level), positive (tilted down). */
  headPitch: number | null
  /** Detected face bounding box in video coordinates. */
  box: { x: number; y: number; width: number; height: number } | null
  /** Face detection confidence score (0 to 1). */
  score: number | null
}

export type DetectOptions = {
  withDescriptor?: boolean
  withExpressions?: boolean
}

const LOCAL_MODEL_BASE = "/models"
const LOCAL_SCRIPT = "/models/face-api.js"
const CDN_BASE = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model"
const CDN_SCRIPT = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.js"

let faceApiPromise: Promise<any> | null = null

/** Load face-api.js from local /models (fast) or CDN fallback. Returns the faceapi global. */
function loadFaceApi(): Promise<any> {
  if (faceApiPromise) return faceApiPromise
  faceApiPromise = new Promise(async (resolve, reject) => {
    try {
      // Load the script from local /models first, fallback to CDN
      if (!(window as any).faceapi) {
        await new Promise<void>((res, rej) => {
          const script = document.createElement("script")
          script.src = LOCAL_SCRIPT
          script.onload = () => res()
          script.onerror = () => {
            const cdnScript = document.createElement("script")
            cdnScript.src = CDN_SCRIPT
            cdnScript.onload = () => res()
            cdnScript.onerror = () => rej(new Error("Failed to load face-api.js"))
            document.head.appendChild(cdnScript)
          }
          document.head.appendChild(script)
        })
      }
      const faceapi = (window as any).faceapi
      if (!faceapi) throw new Error("face-api.js not available")

      // Load models locally first (instantaneous from localhost)
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL_MODEL_BASE),
          faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_MODEL_BASE),
          faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_MODEL_BASE),
          faceapi.nets.faceExpressionNet.loadFromUri(LOCAL_MODEL_BASE),
        ])
      } catch {
        // Fallback to CDN if local models fail
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(CDN_BASE),
          faceapi.nets.faceLandmark68Net.loadFromUri(CDN_BASE),
          faceapi.nets.faceRecognitionNet.loadFromUri(CDN_BASE),
          faceapi.nets.faceExpressionNet.loadFromUri(CDN_BASE),
        ])
      }
      resolve(faceapi)
    } catch (err) {
      faceApiPromise = null
      reject(err)
    }
  })
  return faceApiPromise
}

/** Compute Eye Aspect Ratio from 6 landmark points around one eye. */
function computeEAR(eyePoints: { x: number; y: number }[]): number {
  if (eyePoints.length < 6) return 1
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
  const v1 = dist(eyePoints[1], eyePoints[5])
  const v2 = dist(eyePoints[2], eyePoints[4])
  const h = dist(eyePoints[0], eyePoints[3])
  return h > 0 ? (v1 + v2) / (2 * h) : 1
}

/** Compute Mouth Aspect Ratio. */
function computeMAR(mouthPoints: { x: number; y: number }[]): number {
  if (mouthPoints.length < 20) return 0
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
  // Inner mouth points: 13-19 (indices in the mouth landmarks)
  const v1 = dist(mouthPoints[13], mouthPoints[19])
  const v2 = dist(mouthPoints[14], mouthPoints[18])
  const v3 = dist(mouthPoints[15], mouthPoints[17])
  const h = dist(mouthPoints[12], mouthPoints[16])
  return h > 0 ? (v1 + v2 + v3) / (3 * h) : 0
}

let offscreenCanvas: HTMLCanvasElement | null = null
let offscreenCtx: CanvasRenderingContext2D | null = null

/**
 * Extract horizontal and vertical pupil/iris center within the visible eye opening.
 * Strips away the upper eyelash line and lower lid to eliminate shadow artifacts.
 */
function getPupilOffset(video: HTMLVideoElement, eyePoints: { x: number; y: number }[]): { xOffset: number; yOffset: number } | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0 || eyePoints.length < 6) return null
  if (typeof document === "undefined") return null

  // If candidate is blinking or eye is closed, ignore pupil to prevent false gaze spikes.
  // Blinking has EAR < 0.13. Relaxed from 0.17 so natural eye rolls with slight squint/hooding are NOT dropped.
  if (computeEAR(eyePoints) < 0.13) return null

  // Anatomical inner and outer corners
  const cLeft = eyePoints[0].x < eyePoints[3].x ? eyePoints[0] : eyePoints[3]
  const cRight = eyePoints[0].x < eyePoints[3].x ? eyePoints[3] : eyePoints[0]
  const eyeSpanX = cRight.x - cLeft.x
  if (eyeSpanX < 8) return null

  // Vertical eyelid opening bounds
  const topMidY = (eyePoints[1].y + eyePoints[2].y) / 2
  const botMidY = (eyePoints[4].y + eyePoints[5].y) / 2
  const eyeOpeningH = botMidY - topMidY
  if (eyeOpeningH < 1.8) return null

  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement("canvas")
    offscreenCanvas.width = 36
    offscreenCanvas.height = 16
    offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true })
  }
  if (!offscreenCtx) return null

  // Adaptive vertical crop strictly inside sclera opening:
  // For hooded or narrower eye openings, crop 8% top and 6% bottom so pupil center is never cut off.
  const topSkip = eyeOpeningH > 14 ? eyeOpeningH * 0.14 : eyeOpeningH * 0.08
  const botSkip = eyeOpeningH > 14 ? eyeOpeningH * 0.10 : eyeOpeningH * 0.06
  const cropX = Math.max(0, cLeft.x)
  const cropW = Math.min(video.videoWidth - cropX, eyeSpanX)
  const cropY = Math.max(0, topMidY + topSkip)
  const cropH = Math.min(video.videoHeight - cropY, Math.max(2, eyeOpeningH - topSkip - botSkip))

  if (cropW < 4 || cropH < 2) return null

  try {
    offscreenCtx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, 36, 16)
    const imgData = offscreenCtx.getImageData(0, 0, 36, 16)
    const data = imgData.data

    // Horizontal column brightness profile across sclera + iris
    const colBrightness = new Float32Array(36)
    let minB = 255
    let totalB = 0

    for (let x = 0; x < 36; x++) {
      let sumCol = 0
      for (let y = 0; y < 16; y++) {
        const idx = (y * 36 + x) * 4
        sumCol += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      }
      const avgCol = sumCol / 16
      colBrightness[x] = avgCol
      if (avgCol < minB) minB = avgCol
      totalB += avgCol
    }

    const avgB = totalB / 36
    const contrast = avgB - minB

    // In warm / dim indoor lighting (typical laptop webcam), grayscale contrast is 2.5-5.0.
    // Lower cutoff to 2.2 so eye rolls are reliably detected without dropping frames.
    if (contrast < 2.2) return null

    // Threshold for iris dark center of mass
    const threshold = minB + contrast * 0.48
    let weightedX = 0
    let sumWeightX = 0

    for (let x = 0; x < 36; x++) {
      if (colBrightness[x] <= threshold) {
        const w = (threshold - colBrightness[x]) + 1
        weightedX += x * w
        sumWeightX += w
      }
    }

    if (sumWeightX === 0) return null
    const irisX = weightedX / sumWeightX

    // 1. Dark Iris Centroid Normalized Offset [-1, 1]:
    // Natural iris center range is roughly col 8 to 28 out of 36 columns (normalized deviation ±0.28).
    // Scaling by 2.7 maps screen reading (±0.05 to ±0.08) cleanly to ±0.13 to ±0.22,
    // and lateral eye rolls (±0.20 to ±0.28) sharply to ±0.54 to ±0.75!
    const centroidNorm = (irisX / 35.0) - 0.50
    let xOffset = centroidNorm * 2.7

    // 2. Bilateral Sclera Luminance Asymmetry (Active only during lateral excursions):
    // Only engage when iris moves past the central screen cone (|centroidNorm| > 0.10) to ensure
    // uneven room lighting / shadows NEVER bias the center gaze when looking at the camera!
    if (Math.abs(centroidNorm) > 0.10) {
      let leftSum = 0
      let rightSum = 0
      for (let x = 3; x <= 14; x++) leftSum += colBrightness[x]
      for (let x = 21; x <= 32; x++) rightSum += colBrightness[x]
      const leftAvg = leftSum / 12
      const rightAvg = rightSum / 12
      const scleraDiff = leftAvg - rightAvg
      const scleraBase = Math.max(10, (leftAvg + rightAvg) * 0.5)
      const asymmetry = (scleraDiff / scleraBase) * 0.85
      // Only reinforce if asymmetry agrees with the physical iris excursion direction:
      if (Math.sign(asymmetry) === Math.sign(centroidNorm)) {
        xOffset = xOffset * 0.80 + asymmetry * 0.20
      }
    }

    xOffset = Math.max(-1, Math.min(1, xOffset))

    // Vertical row profile across iris columns (irisX ± 4 columns)
    const xMin = Math.max(0, Math.floor(irisX - 4))
    const xMax = Math.min(35, Math.ceil(irisX + 4))
    const irisColCount = xMax - xMin + 1

    let minRowB = 255
    let totalRowB = 0
    const rowBrightness = new Float32Array(16)

    for (let y = 0; y < 16; y++) {
      let sumRow = 0
      for (let x = xMin; x <= xMax; x++) {
        const idx = (y * 36 + x) * 4
        sumRow += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      }
      const avgRow = sumRow / irisColCount
      rowBrightness[y] = avgRow
      if (avgRow < minRowB) minRowB = avgRow
      totalRowB += avgRow
    }

    const avgRowB = totalRowB / 16
    const rowContrast = avgRowB - minRowB
    let yOffset = 0

    if (rowContrast >= 2.0) {
      const rowThresh = minRowB + rowContrast * 0.48
      let weightedY = 0
      let sumWeightY = 0
      for (let y = 0; y < 16; y++) {
        if (rowBrightness[y] <= rowThresh) {
          const w = (rowThresh - rowBrightness[y]) + 1
          weightedY += y * w
          sumWeightY += w
        }
      }
      if (sumWeightY > 0) {
        const irisY = weightedY / sumWeightY
        // Natural resting iris position in human eye is slightly above vertical midpoint (~0.46)
        yOffset = Math.max(-1, Math.min(1, ((irisY / 15.0) - 0.46) * 2.2))
      }
    }

    return { xOffset, yOffset }
  } catch {
    return null
  }
}

/**
 * Estimate gaze direction combining real pupil/iris eye position and facial landmark head orientation.
 * Returns gazeX: -1 (left) to 1 (right) and gazeY: -1 (up) to 1 (down).
 */
function estimateGaze(
  landmarks: any,
  faceBox: { x: number; y: number; width: number; height: number },
  video?: HTMLVideoElement | null
): { gazeX: number; gazeY: number; headYaw: number; headPitch: number } {
  const nose = landmarks?.getNose?.()
  const leftEye = landmarks?.getLeftEye?.()
  const rightEye = landmarks?.getRightEye?.()
  const jaw = landmarks?.getJawOutline?.()
  const mouth = landmarks?.getMouth?.()

  // 1. Head yaw and pitch from 3D-projected landmark geometry
  let headYaw = 0
  let headPitch = 0

  if (nose && nose.length >= 4 && leftEye && leftEye.length >= 4 && rightEye && rightEye.length >= 4) {
    const noseTip = nose[3] || nose[0]
    const eye1Outer = leftEye[0]
    const eye2Outer = rightEye[3]

    // Compute head roll (tilt angle) from outer eye corners
    const dx = eye2Outer.x - eye1Outer.x
    const dy = eye2Outer.y - eye1Outer.y
    const eyeSpan = Math.max(20, Math.hypot(dx, dy))
    const eyeMidX = (eye1Outer.x + eye2Outer.x) / 2
    const eyeMidY = (eye1Outer.y + eye2Outer.y) / 2
    const rollAngle = Math.atan2(dy, dx)

    // Rotate points into head-aligned coordinates (eliminates head tilt / roll distortion)
    const cosR = Math.cos(-rollAngle)
    const sinR = Math.sin(-rollAngle)
    const unroll = (pt: { x: number; y: number }) => {
      const relX = pt.x - eyeMidX
      const relY = pt.y - eyeMidY
      return {
        x: relX * cosR - relY * sinR,
        y: relX * sinR + relY * cosR,
      }
    }

    const unrolledNose = unroll(noseTip)

    // 3D perspective horizontal offset in head-aligned coordinates:
    const noseOffsetRatio = unrolledNose.x / (eyeSpan * 0.50)

    // Facial silhouette contour symmetry from jawline in head-aligned coordinates
    let jawYaw = 0
    if (jaw && jaw.length >= 17) {
      const unrolledJawLeft = unroll(jaw[0])
      const unrolledJawRight = unroll(jaw[16])
      const distToJawLeft = Math.abs(unrolledNose.x - unrolledJawLeft.x)
      const distToJawRight = Math.abs(unrolledJawRight.x - unrolledNose.x)
      const totalJawDist = distToJawLeft + distToJawRight
      if (totalJawDist > 0) {
        jawYaw = ((distToJawLeft - distToJawRight) / totalJawDist) * 1.3
      }
    }

    // Combined Head Yaw (-1 = turned fully left, +1 = turned fully right)
    headYaw = jaw ? noseOffsetRatio * 0.65 + jawYaw * 0.35 : noseOffsetRatio

    // Anatomical vertical pitch in head-aligned coordinates:
    // Natural screen viewing ratio on a laptop is ~0.50-0.55.
    // Distance-adaptive pitch baseline ensures pitch remains centered around 0.0 at any distance (close vs far):
    // eyeSpan measures distance (close ~80-120px, normal ~50-75px, distant ~30-45px).
    const chin = jaw && jaw.length >= 9 ? jaw[8] : null
    if (chin) {
      const unrolledChin = unroll(chin)
      const faceHeight = Math.max(25, unrolledChin.y)
      const verticalRatio = unrolledNose.y / faceHeight
      const distOffset = Math.max(-0.02, Math.min(0.04, (65 - eyeSpan) * 0.0008))
      const baseline = 0.52 + distOffset
      headPitch = (verticalRatio - baseline) * 1.5
    } else if (mouth && mouth.length >= 7) {
      const mouthPt = mouth[3] || mouth[0]
      const unrolledMouth = unroll(mouthPt)
      const faceSpanY = Math.max(15, unrolledMouth.y)
      const ratio = unrolledNose.y / faceSpanY
      headPitch = (ratio - 0.56) * 1.5
    } else {
      const faceCenterY = faceBox.y + faceBox.height * 0.55
      headPitch = ((noseTip.y - faceCenterY) / (faceBox.height * 0.40)) * 0.7
    }
  }

  // 2. Real eye pupil movement from video frame analysis
  let pupilGazeX = 0
  let pupilGazeY = 0
  let hasPupil = false

  if (video && leftEye && rightEye) {
    const leftPupil = getPupilOffset(video, leftEye)
    const rightPupil = getPupilOffset(video, rightEye)

    if (leftPupil && rightPupil) {
      const avgX = (leftPupil.xOffset + rightPupil.xOffset) / 2
      if (Math.abs(avgX) > 0.18) {
        const sameSign = (leftPupil.xOffset >= 0 && rightPupil.xOffset >= 0) || (leftPupil.xOffset < 0 && rightPupil.xOffset < 0)
        if (sameSign) {
          const dominantX = Math.abs(leftPupil.xOffset) > Math.abs(rightPupil.xOffset) ? leftPupil.xOffset : rightPupil.xOffset
          pupilGazeX = avgX * 0.50 + dominantX * 0.50
        } else {
          pupilGazeX = avgX
        }
      } else {
        // Looking at camera/screen: symmetrical averaging centers the gaze perfectly
        pupilGazeX = avgX
      }
      pupilGazeY = (leftPupil.yOffset + rightPupil.yOffset) / 2
      hasPupil = true
    } else if (leftPupil || rightPupil) {
      const p = leftPupil || rightPupil!
      pupilGazeX = p.xOffset
      pupilGazeY = p.yOffset
      hasPupil = true
    }
  }

  // 3. Combine: eye pupil movement + head pose (distance-invariant screen tracking)
  // Gaze = Head Orientation + Eye-in-Head Rotation (Additive Line of Sight)
  let finalGazeX: number
  let finalGazeY: number

  if (hasPupil) {
    // When head is facing camera (headYaw ~ 0): eye deflection fully drives gaze!
    // When candidate turns head: headYaw contributes directly.
    // When candidate counter-rotates eyes while turning head (VOR): they naturally balance.
    finalGazeX = headYaw * 0.85 + pupilGazeX * 0.90
    finalGazeY = headPitch * 0.75 + pupilGazeY * 0.60
  } else {
    finalGazeX = headYaw
    finalGazeY = headPitch
  }

  return {
    gazeX: Math.max(-1, Math.min(1, finalGazeX)),
    gazeY: Math.max(-1, Math.min(1, finalGazeY)),
    headYaw: Math.max(-1, Math.min(1, headYaw)),
    headPitch: Math.max(-1, Math.min(1, headPitch)),
  }
}

/**
 * React hook for face detection. Call `detect(videoElement)` to analyze a frame.
 */
export function useFaceDetection() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const faceapiRef = useRef<any>(null)

  useEffect(() => {
    loadFaceApi()
      .then((api) => {
        faceapiRef.current = api
        setReady(true)
      })
      .catch((err) => setError(err.message || "Failed to load face detection"))
  }, [])

  const detect = useCallback(
    async (video: HTMLVideoElement, options?: DetectOptions): Promise<FaceDetectionResult> => {
      const faceapi = faceapiRef.current
      if (!faceapi || !video || video.readyState < 2) {
        return { detected: false, faceCount: 0, descriptor: null, expressions: null, landmarks: null, ear: null, eyeHeight: null, mar: null, gazeX: null, gazeY: null, headYaw: null, headPitch: null, box: null, score: null }
      }

      const withDescriptor = options?.withDescriptor ?? true
      const withExpressions = options?.withExpressions ?? true

      // Calibrated face detector threshold (0.20) rejects background artifacts (window grills, shadows)
      // while reliably capturing the candidate's face even in low light.
      let task = faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.20 }))
        .withFaceLandmarks()

      if (withExpressions) {
        task = task.withFaceExpressions()
      }
      if (withDescriptor) {
        task = task.withFaceDescriptors()
      }

      let detections = await task

      // Robust fallbacks (inputSize 512 for distant faces, 320 for close-up)
      if ((!detections || detections.length === 0) && video.readyState >= 2) {
        try {
          let fallbackTask512 = faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.16 }))
            .withFaceLandmarks()
          if (withExpressions) fallbackTask512 = fallbackTask512.withFaceExpressions()
          if (withDescriptor) fallbackTask512 = fallbackTask512.withFaceDescriptors()
          detections = await fallbackTask512
        } catch {}

        if ((!detections || detections.length === 0) && video.readyState >= 2) {
          try {
            let fallbackTask320 = faceapi
              .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.16 }))
              .withFaceLandmarks()
            if (withExpressions) fallbackTask320 = fallbackTask320.withFaceExpressions()
            if (withDescriptor) fallbackTask320 = fallbackTask320.withFaceDescriptors()
            detections = await fallbackTask320
          } catch {}
        }
      }

      if (!detections || detections.length === 0) {
        return { detected: false, faceCount: 0, descriptor: null, allDescriptors: [], expressions: null, landmarks: null, ear: null, eyeHeight: null, mar: null, gazeX: null, gazeY: null, headYaw: null, headPitch: null, box: null, score: null }
      }

      // Sort detections by area descending so the primary candidate in front of the camera is first
      const sortedDetections = [...detections].sort((a: any, b: any) => {
        const areaA = (a.detection?.box?.width || 0) * (a.detection?.box?.height || 0)
        const areaB = (b.detection?.box?.width || 0) * (b.detection?.box?.height || 0)
        return areaB - areaA
      })

      // Rigorously validate EVERY detection (including the primary detection) against real biological facial criteria:
      // Rejects window bars, background furniture, curtains, wallpaper textures, and shadows!
      const validFaces = sortedDetections.filter((d: any, idx: number) => {
        const b = d.detection?.box
        if (!b) return false
        const score = d.detection?.score ?? 0
        const isPrimary = idx === 0

        // Real human face score on TinyFaceDetector is typically 0.35 - 0.99.
        // Reject weak detections below 0.18 for primary face, 0.28 for secondary faces.
        const minScore = isPrimary ? 0.18 : 0.28
        if (score < minScore) return false

        // Dimensions: Real human face in front of a laptop webcam is at least 32x32px
        if (b.width < 32 || b.height < 32) return false

        // Aspect ratio (height / width): human faces are between 0.65 and 1.80
        const aspectRatio = b.height / Math.max(1, b.width)
        if (aspectRatio < 0.65 || aspectRatio > 1.80) return false

        // Biological landmark validation:
        if (!d.landmarks) return false
        const lEye = d.landmarks.getLeftEye?.()
        const rEye = d.landmarks.getRightEye?.()
        const nose = d.landmarks.getNose?.()
        const mouth = d.landmarks.getMouth?.()

        // Must have both eyes with at least 4 landmarks each
        if (!lEye || !rEye || lEye.length < 4 || rEye.length < 4) return false

        // Eyes must have biological horizontal separation
        const eyeDist = Math.hypot(rEye[0].x - lEye[0].x, rEye[0].y - lEye[0].y)
        if (eyeDist < 10) return false

        // Nose tip must be below eyes
        if (nose && nose.length > 3) {
          const avgEyeY = (lEye[0].y + rEye[0].y) / 2
          if (nose[3].y < avgEyeY + 2) return false
        }

        // Mouth must be below nose
        if (mouth && mouth.length > 0 && nose && nose.length > 3) {
          if (mouth[0].y < nose[3].y - 2) return false
        }

        return true
      })

      // If NO detection is a genuine biological human face, return NO FACE DETECTED!
      if (validFaces.length === 0) {
        return {
          detected: false,
          faceCount: 0,
          descriptor: null,
          allDescriptors: [],
          expressions: null,
          landmarks: null,
          ear: null,
          eyeHeight: null,
          mar: null,
          gazeX: null,
          gazeY: null,
          headYaw: null,
          headPitch: null,
          box: null,
          score: null,
        }
      }

      // Use the verified primary candidate face for landmarks, gaze, and identity
      const det = validFaces[0]
      const landmarks = det.landmarks
      const leftEyePoints = landmarks.getLeftEye()
      const rightEyePoints = landmarks.getRightEye()
      const mouthPoints = landmarks.getMouth()
      const nosePoints = landmarks.getNose()
      const jawPoints = landmarks.getJawOutline()

      const leftEAR = computeEAR(leftEyePoints)
      const rightEAR = computeEAR(rightEyePoints)
      const ear = (leftEAR + rightEAR) / 2

      // Physical eyelid opening distance in pixels
      const leftH = (Math.hypot(leftEyePoints[1].x - leftEyePoints[5].x, leftEyePoints[1].y - leftEyePoints[5].y) + Math.hypot(leftEyePoints[2].x - leftEyePoints[4].x, leftEyePoints[2].y - leftEyePoints[4].y)) / 2
      const rightH = (Math.hypot(rightEyePoints[1].x - rightEyePoints[5].x, rightEyePoints[1].y - rightEyePoints[5].y) + Math.hypot(rightEyePoints[2].x - rightEyePoints[4].x, rightEyePoints[2].y - rightEyePoints[4].y)) / 2
      const eyeHeight = (leftH + rightH) / 2

      const mar = computeMAR(mouthPoints)

      const box = det.detection.box
      const { gazeX, gazeY, headYaw, headPitch } = estimateGaze(landmarks, box, video)

      return {
        detected: true,
        faceCount: validFaces.length,
        descriptor: det.descriptor ? Array.from(det.descriptor) : null,
        allDescriptors: validFaces
          .map((d: any) => (d.descriptor ? Array.from(d.descriptor) : null))
          .filter((d: any): d is number[] => Boolean(d)),
        expressions: (det.expressions ?? null) as Record<string, number> | null,
        landmarks: {
          leftEye: leftEyePoints.map((p: any) => ({ x: p.x, y: p.y })),
          rightEye: rightEyePoints.map((p: any) => ({ x: p.x, y: p.y })),
          nose: nosePoints.map((p: any) => ({ x: p.x, y: p.y })),
          mouth: mouthPoints.map((p: any) => ({ x: p.x, y: p.y })),
          jawOutline: jawPoints.map((p: any) => ({ x: p.x, y: p.y })),
        },
        ear,
        eyeHeight,
        mar,
        gazeX,
        gazeY,
        headYaw,
        headPitch,
        box: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
        score: det.detection.score ?? null,
      }
    },
    [],
  )

  /** Compute Euclidean distance between two face descriptors. */
  const faceDistance = useCallback((a: number[], b: number[]): number => {
    if (a.length !== b.length) return Infinity
    let sum = 0
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
    return Math.sqrt(sum)
  }, [])

  return { ready, error, detect, faceDistance }
}
