"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import useSWR from "swr"
import {
  demoAssessments,
  demoJobs,
  demoSubmissions,
  type Assessment,
  type AssessmentSubmission,
  type CandidateProfile,
  type Evaluation,
  type HiringDecision,
  type HiringDecisionStatus,
  type Job,
  type TailoredCv,
  type TruthCheck,
} from "@/lib/demo-data"

/** Shape returned by GET/PUT /api/profile. */
type ProfileResponse = {
  ok: boolean
  profile?: CandidateProfile
  resumeUploaded?: boolean
  resumeFileName?: string | null
}

export const emptyProfile: CandidateProfile = {
  name: "",
  title: "",
  email: "",
  phone: "",
  location: "",
  summary: "",
  skills: [],
  education: [],
  experience: [],
  projects: [],
}

const fetchProfile = async (url: string): Promise<ProfileResponse> => {
  const res = await fetch(url)
  if (!res.ok) return { ok: false }
  return res.json()
}

type JobsResponse = {
  ok: boolean
  source?: string
  jobs?: Job[]
}

const fetchJobs = async (url: string): Promise<JobsResponse> => {
  const res = await fetch(url)
  if (!res.ok) return { ok: false, jobs: [] }
  return res.json()
}

type AppState = {
  resumeUploaded: boolean
  resumeFileName: string | null
  profile: CandidateProfile
  /** True while the persisted profile is still loading from the server. */
  profileLoading: boolean
  /** All jobs including recruiter-published, live listings, and curated roles. */
  allJobs: Job[]
  jobsLoading: boolean
  selectedJobId: string | null
  selectedJob: Job | null
  tailoredJobId: string | null
  tailoredCv: TailoredCv | null
  truthCheckRun: boolean
  truthCheck: TruthCheck | null
  interviewCompleted: boolean
  evaluation: Evaluation | null
  studyProgress: Record<number, boolean>
  assessments: Assessment[]
  submissions: AssessmentSubmission[]
  /** Recruiter hiring decisions, keyed by submission id. Resets on refresh. */
  decisions: Record<string, HiringDecision>
}

type AppActions = {
  uploadResume: (fileName: string, profile: CandidateProfile) => void
  updateProfile: (profile: CandidateProfile) => Promise<boolean>
  selectJob: (id: string, job?: Job | null) => void
  refreshJobs: () => Promise<any>
  markTailored: (jobId: string, cv: TailoredCv) => void
  runTruthCheck: (result: TruthCheck) => void
  completeInterview: (evaluation: Evaluation) => void
  resetInterview: () => void
  toggleStudyWeek: (week: number) => void
  saveAssessment: (assessment: Assessment) => void
  deleteAssessment: (id: string) => void
  addSubmission: (submission: AssessmentSubmission) => void
  /** Record (or clear, when status is "undecided") a recruiter hiring decision. */
  setDecision: (submissionId: string, status: HiringDecisionStatus, note?: string) => void
}

const AppContext = createContext<(AppState & AppActions) | null>(null)

/** State that is still session-scoped (not yet persisted to Postgres). */
type LocalState = Omit<AppState, "resumeUploaded" | "resumeFileName" | "profile" | "profileLoading" | "allJobs" | "jobsLoading">

export function AppProvider({ children }: { children: ReactNode }) {
  // Profile + resume live in Postgres, keyed by the authenticated user id.
  const { data, isLoading, mutate } = useSWR<ProfileResponse>("/api/profile", fetchProfile, {
    revalidateOnFocus: false,
  })

  // All jobs (recruiter database postings + live listings from Jobful/IndianAPI)
  const { data: jobsResponse, isLoading: jobsLoading, mutate: mutateJobs } = useSWR<JobsResponse>(
    "/api/jobs",
    fetchJobs,
    {
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    }
  )

  const allJobs = useMemo<Job[]>(() => {
    const fetched = jobsResponse?.jobs || []
    const map = new Map<string, Job>()
    // Add recruiter / live jobs first
    for (const j of fetched) {
      if (j?.id) map.set(j.id, j)
    }
    // Add demo jobs if not already present
    for (const j of demoJobs) {
      if (j?.id && !map.has(j.id)) map.set(j.id, j)
    }
    return Array.from(map.values())
  }, [jobsResponse?.jobs])

  const [state, setState] = useState<LocalState>({
    selectedJobId: "python-backend-developer",
    selectedJob: demoJobs.find((j) => j.id === "python-backend-developer") ?? null,
    tailoredJobId: null,
    tailoredCv: null,
    truthCheckRun: false,
    truthCheck: null,
    interviewCompleted: false,
    evaluation: null,
    studyProgress: {},
    assessments: demoAssessments,
    submissions: demoSubmissions,
    decisions: {},
  })

  const resolvedSelectedJob = useMemo(() => {
    if (state.selectedJob && state.selectedJob.id === state.selectedJobId) {
      return state.selectedJob
    }
    return allJobs.find((j) => j.id === state.selectedJobId) ?? demoJobs.find((j) => j.id === state.selectedJobId) ?? null
  }, [state.selectedJob, state.selectedJobId, allJobs])

  const selectJob = useCallback((id: string, job?: Job | null) => {
    setState((s) => ({
      ...s,
      selectedJobId: id,
      selectedJob: job ?? null,
    }))
  }, [])

  const value = useMemo<AppState & AppActions>(
    () => ({
      ...state,
      allJobs,
      jobsLoading,
      refreshJobs: () => mutateJobs(),
      selectedJob: resolvedSelectedJob,
      profile: data?.profile ?? emptyProfile,
      resumeUploaded: data?.resumeUploaded ?? false,
      resumeFileName: data?.resumeFileName ?? null,
      profileLoading: isLoading,
      // The resume route already persisted this payload; refresh the cache with it.
      uploadResume: (fileName, profile) => {
        void mutate({ ok: true, profile, resumeUploaded: true, resumeFileName: fileName }, { revalidate: false })
      },
      // Optimistically show the edit, then persist it for the session user.
      updateProfile: async (profile) => {
        try {
          await mutate(
            async () => {
              const res = await fetch("/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(profile),
              })
              if (!res.ok) throw new Error("profile_save_failed")
              return res.json()
            },
            {
              optimisticData: (current) => ({ ...(current ?? { ok: true }), ok: true, profile }),
              rollbackOnError: true,
              revalidate: true,
            },
          )
          return true
        } catch (err) {
          console.error("[store] profile update failed:", err)
          return false
        }
      },
      selectJob,
      markTailored: (jobId, cv) =>
        setState((s) => ({ ...s, tailoredJobId: jobId, tailoredCv: cv, truthCheckRun: false, truthCheck: null })),
      runTruthCheck: (result) => setState((s) => ({ ...s, truthCheckRun: true, truthCheck: result })),
      completeInterview: (evaluation) => setState((s) => ({ ...s, interviewCompleted: true, evaluation })),
      resetInterview: () => setState((s) => ({ ...s, interviewCompleted: false, evaluation: null })),
      toggleStudyWeek: (week) =>
        setState((s) => ({ ...s, studyProgress: { ...s.studyProgress, [week]: !s.studyProgress[week] } })),
      // Insert or update an assessment (draft or published) by id.
      saveAssessment: (assessment) =>
        setState((s) => {
          const exists = s.assessments.some((a) => a.id === assessment.id)
          return {
            ...s,
            assessments: exists
              ? s.assessments.map((a) => (a.id === assessment.id ? assessment : a))
              : [assessment, ...s.assessments],
          }
        }),
      deleteAssessment: (id) => setState((s) => ({ ...s, assessments: s.assessments.filter((a) => a.id !== id) })),
      // Prepend the newest submission so recruiter results show it first.
      addSubmission: (submission) => setState((s) => ({ ...s, submissions: [submission, ...s.submissions] })),
      // Record a hiring decision, or clear it when the recruiter resets to "undecided".
      setDecision: (submissionId, status, note) =>
        setState((s) => {
          const next = { ...s.decisions }
          if (status === "undecided") {
            delete next[submissionId]
          } else {
            next[submissionId] = { submissionId, status, note, decidedAt: new Date().toISOString() }
          }
          return { ...s, decisions: next }
        }),
    }),
    [state, data, isLoading, mutate, allJobs, jobsLoading, mutateJobs, resolvedSelectedJob, selectJob],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
