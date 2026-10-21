"use client"

import Link from "next/link"
import { ArrowLeft, Sparkles } from "lucide-react"
import { PageHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { AgenticJobCreator } from "@/components/recruiter/agentic-job-creator"
import { useApp } from "@/lib/store"

export default function AgenticJobCreatorPage() {
  const { saveAssessment, refreshJobs } = useApp()

  const handleJobPublished = (result: any, draft?: any) => {
    void refreshJobs()
    if (draft && result.jobId) {
      saveAssessment({
        id: result.assessmentId,
        title: `${draft.title} Technical Screening`,
        jobId: result.jobId,
        jobTitle: draft.title,
        company: draft.company || "Hiring Partner",
        difficulty: "Medium",
        status: "published",
        questions: (draft.interviewQuestions || []).map((q: any, idx: number) => ({
          id: `q-${idx + 1}`,
          type: "short" as const,
          skill: q.skill || "Technical",
          difficulty: "Medium" as const,
          question: q.question,
          options: [],
          correctIndex: 0,
          explanation: "",
          keyPoints: q.keyPoints || [],
        })),
        createdAt: new Date().toISOString(),
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agentic Job & Interview Creator"
        description="Provide a brief prompt about your hiring needs. The AI Agent will draft a comprehensive Job Description, generate tailored technical screening questions, and publish directly to candidates."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/recruiter" />}>
            <ArrowLeft className="size-4" /> Back to Overview
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-4xl">
        <AgenticJobCreator onJobPublished={handleJobPublished} />
      </div>
    </div>
  )
}
