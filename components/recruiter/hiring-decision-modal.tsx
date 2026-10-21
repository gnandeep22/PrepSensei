"use client"

import { useState } from "react"
import {
  Mail,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  FileText,
  Star,
  ChevronsUp,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export type HiringDecisionModalProps = {
  submissionId: string
  candidateUserId: string
  candidateName: string
  candidateEmail?: string
  jobTitle: string
  company: string
  overallScore?: number
  currentStatus?: "shortlisted" | "advanced" | "rejected" | "undecided"
  onDecisionSubmitted?: (status: "shortlisted" | "advanced" | "rejected", note?: string) => void
}

export function HiringDecisionManager({
  submissionId,
  candidateUserId,
  candidateName,
  candidateEmail,
  jobTitle,
  company,
  overallScore,
  currentStatus = "undecided",
  onDecisionSubmitted,
}: HiringDecisionModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<"shortlisted" | "advanced" | "rejected">(
    currentStatus !== "undecided" ? currentStatus : "shortlisted"
  )
  const [subject, setSubject] = useState(getTemplateSubject("shortlisted", candidateName, jobTitle, company))
  const [message, setMessage] = useState(getTemplateBody("shortlisted", candidateName, jobTitle, company, overallScore))
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [resultMsg, setResultMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<"compose" | "preview">("compose")

  const handleStatusChange = (status: "shortlisted" | "advanced" | "rejected") => {
    setSelectedStatus(status)
    setSubject(getTemplateSubject(status, candidateName, jobTitle, company))
    setMessage(getTemplateBody(status, candidateName, jobTitle, company, overallScore))
    setResultMsg(null)
  }

  const handleSendDecision = async () => {
    setSending(true)
    setResultMsg(null)

    try {
      const res = await fetch("/api/recruiter/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          candidateUserId,
          candidateEmail,
          candidateName,
          jobTitle,
          company,
          status: selectedStatus,
          subject,
          message,
          note: note.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to record decision")
      }

      const data = await res.json()
      setResultMsg({
        type: "success",
        text: data.emailSent
          ? `Decision recorded and email successfully delivered to ${candidateEmail || candidateName} via Gmail!`
          : `Decision recorded in database. (Email note: ${data.emailError || "Check Gmail SMTP"})`,
      })
      onDecisionSubmitted?.(selectedStatus, note)
    } catch (err: any) {
      setResultMsg({ type: "error", text: err.message || "Failed to record decision" })
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="size-4 text-primary" /> Recruiter Decision &amp; Candidate Notification
            </CardTitle>
            <CardDescription>
              Select an outcome to load professional email &amp; dashboard templates. Send directly to the candidate&apos;s inbox via Gmail SMTP.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={
              selectedStatus === "shortlisted"
                ? "text-success border-success/40"
                : selectedStatus === "advanced"
                ? "text-primary border-primary/40"
                : "text-destructive border-destructive/40"
            }
          >
            {selectedStatus.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Outcome Selector Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={selectedStatus === "shortlisted" ? "default" : "outline"}
            onClick={() => handleStatusChange("shortlisted")}
            className={selectedStatus === "shortlisted" ? "bg-success text-success-foreground hover:bg-success/90" : ""}
          >
            <Star className="size-3.5 mr-1.5" /> Shortlist Candidate
          </Button>

          <Button
            type="button"
            size="sm"
            variant={selectedStatus === "advanced" ? "default" : "outline"}
            onClick={() => handleStatusChange("advanced")}
          >
            <ChevronsUp className="size-3.5 mr-1.5" /> Advance to Next Round
          </Button>

          <Button
            type="button"
            size="sm"
            variant={selectedStatus === "rejected" ? "default" : "outline"}
            onClick={() => handleStatusChange("rejected")}
            className={selectedStatus === "rejected" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            <XCircle className="size-3.5 mr-1.5" /> Reject / Archive
          </Button>
        </div>

        {/* Email Template Editor */}
        <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/10 p-3.5">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileText className="size-3.5" />
              Template: {selectedStatus === "shortlisted" ? "Shortlist Invitation" : selectedStatus === "advanced" ? "Next Round Advancement" : "Courteous Rejection"}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("compose")}
                className={`px-2 py-0.5 text-xs font-medium rounded ${activeTab === "compose" ? "bg-muted font-bold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-2 py-0.5 text-xs font-medium rounded ${activeTab === "preview" ? "bg-muted font-bold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Preview
              </button>
            </div>
          </div>

          {activeTab === "compose" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Email Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">
                  Email Message Body (Will be styled and sent via Gmail)
                </Label>
                <Textarea
                  rows={7}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="text-xs leading-relaxed font-sans"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Internal Recruiter Note (Optional - visible only to your team)</Label>
                <Input
                  placeholder="e.g. Scored 88% on React & System Design. Strong communicator."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-md border border-border/70 bg-card p-4 text-xs">
              <div className="flex items-center justify-between border-b pb-2 text-muted-foreground">
                <span>To: <strong>{candidateEmail || candidateName}</strong></span>
                <span>From: <strong>{company} Recruitment Team</strong></span>
              </div>
              <p className="font-semibold text-sm pt-1">{subject}</p>
              <p className="whitespace-pre-line text-muted-foreground leading-relaxed pt-1">{message}</p>
            </div>
          )}
        </div>

        {/* Feedback message */}
        {resultMsg && (
          <div
            className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
              resultMsg.type === "success"
                ? "border-success/40 bg-success/10 text-success"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {resultMsg.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            )}
            <span>{resultMsg.text}</span>
          </div>
        )}

        {/* Send Button */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-muted-foreground">
            Delivers via Gmail SMTP and posts notification on candidate dashboard.
          </p>
          <Button
            size="sm"
            onClick={handleSendDecision}
            disabled={sending || !subject.trim() || !message.trim()}
            className="text-xs font-semibold"
          >
            {sending ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" /> Sending…
              </>
            ) : (
              <>
                <Send className="size-3.5 mr-1.5" /> Send Email &amp; Record Decision
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function getTemplateSubject(
  status: "shortlisted" | "advanced" | "rejected",
  name: string,
  jobTitle: string,
  company: string
): string {
  switch (status) {
    case "shortlisted":
      return `Congratulations! You've been shortlisted for ${jobTitle} at ${company}`
    case "advanced":
      return `Next Round Invitation: ${jobTitle} at ${company}`
    case "rejected":
      return `Application Update: ${jobTitle} at ${company}`
  }
}

function getTemplateBody(
  status: "shortlisted" | "advanced" | "rejected",
  name: string,
  jobTitle: string,
  company: string,
  score?: number
): string {
  const scoreText = score ? `Your AI technical screening score was ${score}%. ` : ""
  switch (status) {
    case "shortlisted":
      return `Hello ${name || "Candidate"},\n\nWe are excited to share that your application and screening interview for the ${jobTitle} position at ${company} have been reviewed.\n\n${scoreText}Based on your strong performance and alignment with our technical criteria, you have been SHORTLISTED for the role.\n\nOur team is currently finalizing interview slots for the upcoming round. We will reach out shortly with details to schedule your conversation with the engineering team.\n\nCongratulations, and we look forward to speaking with you!\n\nBest regards,\n${company} Hiring Team`

    case "advanced":
      return `Hello ${name || "Candidate"},\n\nGreat news! Following your technical assessment and interview for ${jobTitle} at ${company}, we would like to officially ADVANCE you to the next stage of our interview process.\n\n${scoreText}Our team was impressed with your technical problem-solving and domain knowledge.\n\nPlease reply directly to this email or visit your PrepSensei candidate dashboard with your availability over the next 3 business days.\n\nWarm regards,\n${company} Talent Acquisition`

    case "rejected":
      return `Hello ${name || "Candidate"},\n\nThank you for taking the time to apply and complete the technical interview for the ${jobTitle} role at ${company}.\n\nWe had the opportunity to review your profile and assessment responses thoroughly. While we were impressed by your background, we have decided to proceed with other candidates whose experience aligns more specifically with our immediate deliverables.\n\nWe will keep your resume and technical profile in our active talent directory for future opportunities that match your expertise. We wish you the very best in your search.\n\nSincerely,\n${company} Recruitment Team`
  }
}

export function HiringDecisionModal({
  submission,
  open,
  onClose,
  onDecisionSaved,
}: {
  submission: any
  open: boolean
  onClose: () => void
  onDecisionSaved?: () => void
}) {
  if (!open || !submission) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-card border border-border shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <HiringDecisionManager
          submissionId={submission.id}
          candidateUserId={submission.candidateUserId}
          candidateName={submission.candidateName}
          candidateEmail={submission.answers?.email || undefined}
          jobTitle={submission.jobTitle}
          company={submission.company}
          overallScore={submission.result?.overallScore ?? undefined}
          onDecisionSubmitted={() => {
            onDecisionSaved?.()
            onClose()
          }}
        />
      </div>
    </div>
  )
}

