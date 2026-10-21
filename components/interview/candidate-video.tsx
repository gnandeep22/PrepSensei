"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Camera, CameraOff, EyeOff, MicOff, Users, VideoOff } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The candidate's real camera tile. Uses the browser camera via
 * getUserMedia. If permission is denied or no camera exists, it shows a
 * "Camera unavailable" placeholder and the interview continues — it never
 * crashes and never fabricates a video stream.
 */
export function CandidateVideo({
  cameraOn,
  micOn,
  name = "You",
  faceDetected = true,
  identityMismatch = false,
  multipleFaces = 0,
  multipleFacesDetected,
  cameraMovementDetected = false,
  gazeAway = false,
  onVideoReady,
}: {
  cameraOn: boolean
  micOn: boolean
  name?: string
  faceDetected?: boolean
  identityMismatch?: boolean
  multipleFaces?: number
  multipleFacesDetected?: boolean
  cameraMovementDetected?: boolean
  gazeAway?: boolean
  onVideoReady?: (video: HTMLVideoElement) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function enable() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("Camera not supported in this browser.")
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          onVideoReady?.(videoRef.current)
        }
        setError(null)
      } catch {
        setError("Camera unavailable")
      }
    }

    function disable() {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
    }

    if (cameraOn) enable()
    else disable()

    return () => {
      cancelled = true
      disable()
    }
  }, [cameraOn])

  const hasMultipleFaces = multipleFacesDetected !== undefined ? multipleFacesDetected : multipleFaces > 1

  return (
    <div
      className={cn(
        "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border bg-card/60 transition-all duration-300 shadow-sm",
        faceDetected && identityMismatch
          ? "border-destructive ring-4 ring-destructive/40 shadow-lg shadow-destructive/20 animate-pulse"
          : hasMultipleFaces || cameraMovementDetected
          ? "border-amber-500 ring-4 ring-amber-500/30 shadow-lg shadow-amber-500/20 animate-pulse"
          : "border-border/80 hover:border-border",
      )}
    >
      {cameraOn && !error ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={() => {
            if (videoRef.current) onVideoReady?.(videoRef.current)
          }}
          // Mirror the preview like a typical video-call self-view.
          className="size-full -scale-x-100 object-cover"
          aria-label="Your camera preview"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground p-6">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted/60 border border-border">
            {error ? <CameraOff className="size-6 text-destructive" /> : <VideoOff className="size-6 text-muted-foreground" />}
          </div>
          <span className="text-xs sm:text-sm font-medium">{error ?? "Camera is turned off"}</span>
        </div>
      )}

      {/* Candidate Name Tag & Live Mic Status */}
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-border/70 bg-card/85 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur-md shadow-xs">
        <span className={cn("size-2 rounded-full", micOn ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50")} />
        <span>{name}</span>
      </div>

      {/* Multi-Error Live Proctoring HUD Stack (Adapts simultaneously to all active violations) */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5 z-20 pointer-events-none">
        {faceDetected && identityMismatch && (
          <div className="flex items-center gap-1.5 rounded-full border border-destructive/90 bg-destructive/95 px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md animate-pulse">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>Identity Mismatch</span>
          </div>
        )}
        {hasMultipleFaces && (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/90 bg-amber-600/95 px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md animate-pulse">
            <Users className="size-3.5 shrink-0" />
            <span>{Math.max(2, multipleFaces)} Faces in Frame</span>
          </div>
        )}
        {cameraMovementDetected && (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/90 bg-amber-600/95 px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md animate-pulse">
            <Camera className="size-3.5 shrink-0" />
            <span>Camera Movement</span>
          </div>
        )}
        {faceDetected && gazeAway && !identityMismatch && (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/90 bg-amber-600/95 px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md animate-pulse">
            <EyeOff className="size-3.5 shrink-0" />
            <span>Looking Away</span>
          </div>
        )}
      </div>

      {!micOn && (
        <div
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-border/80 bg-card/85 px-2.5 py-1 text-xs font-medium text-destructive backdrop-blur-md shadow-xs"
          aria-label="Microphone muted"
        >
          <MicOff className="size-3.5" /> Muted
        </div>
      )}
    </div>
  )
}
