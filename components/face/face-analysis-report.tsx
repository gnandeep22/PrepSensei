"use client"

import { AlertTriangle, Camera, CheckCircle2, Eye, EyeOff, MessageSquare, ScanFace, Shield, ShieldCheck, Users } from "lucide-react"
import type { InterviewFaceReport } from "@/lib/db/schema"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

function StatRow({ label, value, icon, tone }: {
  label: string
  value: string | number
  icon?: React.ReactNode
  tone?: "success" | "warning" | "destructive" | "muted"
}) {
  const toneClasses = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    muted: "text-muted-foreground",
  }
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className={cn("text-sm font-semibold tabular-nums", tone ? toneClasses[tone] : "")}>{value}</span>
    </div>
  )
}

export function FaceAnalysisReport({
  report,
  registration,
  candidateName,
}: {
  report: InterviewFaceReport
  registration?: {
    livenessVerified: boolean
    smileDetected: boolean
    blinkDetected: boolean
    registeredAt: string
    photos?: { front?: string | null; left?: string | null; right?: string | null } | null
  } | null
  candidateName?: string
}) {
  const isMismatchDetected = Boolean(
    report.identityMismatchDetected ||
    (!report.identityVerified && (report.mismatchCount > 0 || (report.matchCount === 0 && Boolean(registration || report.registeredPhotos))))
  )
  const hasMultipleFaces = Boolean(report.multipleFacesDetected || report.multipleFaceCount > 0)
  const identityTone = isMismatchDetected ? "destructive" : report.identityVerified ? "success" : "warning"
  const gazeTone = report.gazeTowardPercent >= 70 ? "success" : report.gazeTowardPercent >= 40 ? "warning" : "destructive"

  const regPhoto = registration?.photos?.front || report.registeredPhotos?.front || null
  const intervieweePhoto = report.intervieweePhoto || report.entryPhoto || null

  return (
    <div className="flex flex-col gap-4">
      {/* High-Priority Recruiter Audit Alert: Identity Mismatch */}
      {isMismatchDetected && (
        <div className="rounded-xl border border-destructive/60 bg-destructive/10 p-4 shadow-sm flex items-start gap-3.5 animate-pulse">
          <div className="rounded-full bg-destructive/20 p-2 text-destructive shrink-0">
            <AlertTriangle className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-destructive flex items-center gap-2">
              🚨 CRITICAL AUDIT ALERT: Candidate Identity Mismatch Detected
            </h3>
            <p className="text-xs text-foreground/90 leading-relaxed">
              The vision AI proctoring system determined that the person who attended this interview did <strong>NOT</strong> match the biometric face descriptor registered to <strong>{candidateName || "the candidate"}</strong> ({report.mismatchCount} mismatch checks logged).
            </p>
            <p className="text-xs text-destructive font-medium mt-0.5">
              <strong>Recruiter Action Required:</strong> Potential impersonation flagged. Compare the live interview snapshot below against the registered biometric identity reference.
            </p>
          </div>
        </div>
      )}

      {/* Proctoring Alert: Multiple Faces Detected */}
      {hasMultipleFaces && (
        <div className="rounded-xl border border-amber-500/60 bg-amber-500/10 p-4 shadow-sm flex items-start gap-3.5">
          <div className="rounded-full bg-amber-500/20 p-2 text-amber-600 dark:text-amber-400 shrink-0">
            <Users className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-amber-700 dark:text-amber-300">
              ⚠ PROCTORING AUDIT: Multiple Faces Detected ({report.multipleFaceCount} violations)
            </h3>
            <p className="text-xs text-foreground/90 leading-relaxed">
              Two or more individuals were detected in the video frame during this interview session. Please inspect the proctoring timeline below for unauthorized room assistance.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanFace className="size-4 text-primary" /> Face Analysis &amp; Biometric Report
            </CardTitle>
            <Badge variant="outline" className="text-muted-foreground">
              {Math.floor(report.totalDurationSec / 60)}m {report.totalDurationSec % 60}s analysed
            </Badge>
          </div>
          <CardDescription className="text-pretty">
            Behavioural observations and biometric identity verification throughout the interview.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Side-by-side Biometric Face Comparison (Registered vs Interviewee) */}
      {(regPhoto || intervieweePhoto || isMismatchDetected || report.identityVerified) && (
        <Card className="border-border/80 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-primary" /> Biometric Identity Matching Proof
              </CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  "font-bold text-xs flex items-center gap-1",
                  isMismatchDetected
                    ? "border-destructive/60 bg-destructive/15 text-destructive"
                    : report.identityVerified
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-warning/40 bg-warning/10 text-warning",
                )}
              >
                {isMismatchDetected ? (
                  <>
                    <AlertTriangle className="size-3" /> ⚠ Identity Mismatch Detected
                  </>
                ) : report.identityVerified ? (
                  <>
                    <CheckCircle2 className="size-3" /> ✓ Biometric Identity Confirmed
                  </>
                ) : (
                  "Identity Verification Pending"
                )}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Matching the face of the candidate who registered biometrics against the person who took the interview.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Registered Reference Photo */}
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border/80 bg-card p-3 text-center">
                <span className="text-xs font-semibold text-muted-foreground">1. Registered Identity</span>
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black/30 flex items-center justify-center">
                  {regPhoto ? (
                    <img src={regPhoto} alt="Registered Identity" className="size-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground text-xs p-2">
                      <Camera className="size-5 stroke-[1.5]" />
                      <span>Reference on file</span>
                    </div>
                  )}
                  {regPhoto && (
                    <div className="absolute right-1.5 top-1.5 rounded-full bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                      Registered
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Captured at biometric onboarding / sign-up</p>
              </div>

              {/* Interviewee Photo (Captured live during interview) */}
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border/80 bg-card p-3 text-center">
                <span className="text-xs font-semibold text-muted-foreground">2. Interviewee (Live Stream)</span>
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black/30 flex items-center justify-center">
                  {intervieweePhoto ? (
                    <img src={intervieweePhoto} alt="Live Interview Candidate" className="size-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground text-xs p-2">
                      <Camera className="size-5 stroke-[1.5]" />
                      <span>Live camera feed</span>
                    </div>
                  )}
                  {intervieweePhoto && (
                    <div
                      className={cn(
                        "absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow",
                        isMismatchDetected ? "bg-destructive" : "bg-primary",
                      )}
                    >
                      {isMismatchDetected ? "Mismatch" : "Live Feed"}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Captured live during actual interview session</p>
              </div>
            </div>

            <div
              className={cn(
                "rounded-lg border p-3 flex items-start gap-2.5 text-xs",
                isMismatchDetected
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : report.identityVerified
                  ? "border-success/30 bg-success/5 text-success"
                  : "border-warning/30 bg-warning/5 text-warning",
              )}
            >
              {isMismatchDetected ? (
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-destructive" />
              ) : (
                <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-success" />
              )}
              <div className="text-pretty">
                <span className="font-semibold text-foreground">
                  {isMismatchDetected
                    ? "Candidate Impersonation Alert: "
                    : report.identityVerified
                    ? "Identity Match Confirmed: "
                    : "Identity Status: "}
                </span>
                <span className="text-muted-foreground">
                  {isMismatchDetected
                    ? `The face in the live interview video does NOT match the registered biometric profile of ${candidateName || "the candidate"} (${report.mismatchCount} failed biometric checks). A different person appeared to attend this interview.`
                    : report.identityVerified
                    ? `The candidate (${candidateName || "Candidate"}) who registered their biometric profile is mathematically verified as the same person who completed this interview (${report.matchCount} continuous matches, 0 identity breaches).`
                    : "Continuous face verification did not establish a conclusive biometric match during the interview questions."}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Identity Verification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4" /> Identity Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {registration && (
              <>
                <StatRow
                  label="Registration liveness"
                  value={registration.livenessVerified ? "Passed" : "Not verified"}
                  icon={registration.livenessVerified ? <CheckCircle2 className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warning" />}
                  tone={registration.livenessVerified ? "success" : "warning"}
                />
                <StatRow
                  label="Smile verification"
                  value={registration.smileDetected ? "Detected" : "Not detected"}
                  tone={registration.smileDetected ? "success" : "muted"}
                />
                <StatRow
                  label="Blink verification"
                  value={registration.blinkDetected ? "Detected" : "Not detected"}
                  tone={registration.blinkDetected ? "success" : "muted"}
                />
              </>
            )}
            <StatRow
              label="Interview face match"
              value={isMismatchDetected ? "MISMATCH DETECTED" : report.identityVerified ? "Verified" : "Not verified"}
              icon={isMismatchDetected ? <AlertTriangle className="size-4 text-destructive" /> : report.identityVerified ? <CheckCircle2 className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warning" />}
              tone={isMismatchDetected ? "destructive" : report.identityVerified ? "success" : "warning"}
            />
            <StatRow label="Match events" value={report.matchCount} tone="success" />
            <StatRow
              label="Mismatch events"
              value={report.mismatchCount}
              tone={report.mismatchCount > 0 ? "destructive" : "success"}
            />
            <StatRow
              label="Multiple-face events"
              value={report.multipleFaceCount}
              icon={<Users className="size-4" />}
              tone={report.multipleFaceCount > 0 ? "warning" : "success"}
            />
            <StatRow
              label="Face-not-visible events"
              value={report.noFaceCount}
              icon={<EyeOff className="size-4" />}
              tone={report.noFaceCount > 3 ? "warning" : "success"}
            />
            <StatRow
              label="Camera movement events"
              value={report.cameraMovementCount ?? 0}
              icon={<Camera className="size-4" />}
              tone={(report.cameraMovementCount ?? 0) > 2 ? "warning" : "muted"}
            />
          </CardContent>
        </Card>

        {/* Eye/Gaze Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="size-4" /> Eye Contact / Gaze Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Facing camera</span>
                <span className={cn("font-semibold tabular-nums", gazeTone === "success" ? "text-success" : gazeTone === "warning" ? "text-warning" : "text-destructive")}>
                  {report.gazeTowardPercent}%
                </span>
              </div>
              <Progress value={report.gazeTowardPercent} className="h-2" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Looking away</span>
                <span className="font-semibold tabular-nums text-muted-foreground">{report.gazeAwayPercent}%</span>
              </div>
              <Progress value={report.gazeAwayPercent} className="h-2" />
            </div>
            <StatRow
              label="Total look-away / stare events"
              value={report.gazeAwayCount ?? report.events.filter((e) => e.type === "gaze_away").length}
              icon={<EyeOff className="size-4" />}
              tone={(report.gazeAwayCount ?? 0) > 8 ? "warning" : "muted"}
            />
            <StatRow
              label="Prolonged gaze-away events (>3s)"
              value={report.prolongedGazeAwayCount}
              tone={report.prolongedGazeAwayCount > 3 ? "warning" : "success"}
            />
            {report.events.filter((e) => e.type === "gaze_away").length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <p className="text-xs font-medium text-muted-foreground">Stare Timeline ({report.events.filter((e) => e.type === "gaze_away").length} events):</p>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                  {report.events
                    .filter((e) => e.type === "gaze_away")
                    .slice(0, 15)
                    .map((e, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded border border-border/60 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <EyeOff className="size-3 text-muted-foreground" />
                          <span>At {formatTime(e.timestamp)}</span>
                        </div>
                        <Badge variant={(e.duration ?? 0) >= 3 ? "destructive" : "secondary"} className="text-[10px] h-4 px-1.5 font-mono">
                          {(e.duration ?? 0) >= 3 ? `Prolonged (${e.duration}s)` : `${e.duration}s stare`}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lip/Mouth Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="size-4" /> Lip / Mouth Movement Analysis
          </CardTitle>
          <CardDescription>
            Observed mouth movement during the interview. This indicates visible speech activity — it is not a measure
            of answer quality.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Mouth movement detected</span>
              <span className="font-semibold tabular-nums">{report.mouthMovementPercent}%</span>
            </div>
            <Progress value={report.mouthMovementPercent} className="h-2" />
          </div>

          {report.speakingIntervals.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">Speaking intervals</p>
              <div className="flex flex-wrap gap-1">
                {report.speakingIntervals.slice(0, 10).map((iv, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {formatTime(iv.startSec)} – {formatTime(iv.endSec)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {report.silentIntervals.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">Low/no movement intervals</p>
              <div className="flex flex-wrap gap-1">
                {report.silentIntervals.slice(0, 10).map((iv, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {formatTime(iv.startSec)} – {formatTime(iv.endSec)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overall Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overall Technical Summary</CardTitle>
          <CardDescription className="text-pretty">
            This summary presents measured behavioural observations only. Looking away or reduced mouth movement
            does not indicate dishonesty — these are technical signals for the interviewer's consideration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2.5 text-sm">
            {isMismatchDetected ? (
              <li className="flex items-start gap-2 font-bold text-destructive">
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-destructive" />
                <span>
                  CRITICAL AUDIT: Biometric identity mismatch detected. The person in the interview room did not match the registered candidate biometrics ({report.mismatchCount} mismatch checks logged). A different individual appeared to take this interview.
                </span>
              </li>
            ) : (
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" />
                Identity was verified during the interview ({report.matchCount} match{report.matchCount !== 1 ? "es" : ""}, {report.mismatchCount} mismatch{report.mismatchCount !== 1 ? "es" : ""}).
              </li>
            )}

            {report.multipleFaceCount > 0 && (
              <li className="flex items-start gap-2 font-semibold text-amber-600 dark:text-amber-400">
                <Users className="size-4 shrink-0 mt-0.5 text-amber-500" />
                <span>
                  PROCTORING ALERT: Multiple faces were detected {report.multipleFaceCount} time{report.multipleFaceCount !== 1 ? "s" : ""} during the interview session.
                </span>
              </li>
            )}

            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
              Candidate appeared to face the camera approximately {report.gazeTowardPercent}% of the time.
            </li>
            {report.prolongedGazeAwayCount > 0 && (
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                {report.prolongedGazeAwayCount} prolonged gaze-away event{report.prolongedGazeAwayCount !== 1 ? "s" : ""} (&gt;3 seconds) were observed.
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
              Visible mouth movement was detected {report.mouthMovementPercent}% of the time.
            </li>
            {report.noFaceCount > 3 && (
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                The candidate's face was not visible {report.noFaceCount} time{report.noFaceCount !== 1 ? "s" : ""}.
              </li>
            )}
            {(report.cameraMovementCount ?? 0) > 0 && (
              <li className="flex items-start gap-2 font-medium text-amber-600 dark:text-amber-400">
                <Camera className="size-4 shrink-0 mt-0.5 text-amber-500" />
                <span>
                  Camera movement or position shifts were detected {report.cameraMovementCount} time{report.cameraMovementCount !== 1 ? "s" : ""} during the interview.
                </span>
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}
