import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import type {
  AssessmentQuestion,
  AssessmentResult,
  Difficulty,
  Education,
  Evaluation,
  Experience,
  IntegrityResult,
  Job,
  Project,
  SimilarityResult,
} from "@/lib/demo-data"

// --- Better Auth tables (do not rename columns) ---

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  // Application role: "candidate" or "recruiter". Set at sign-up.
  role: text("role").notNull().default("candidate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// --- Application tables ---

/**
 * One row per candidate, keyed by the Better Auth user id. Ownership is always
 * derived from the server session, never from a client-supplied id.
 */
export const candidateProfile = pgTable("candidate_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  title: text("title").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  location: text("location").notNull().default(""),
  summary: text("summary").notNull().default(""),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  education: jsonb("education").$type<Education[]>().notNull().default([]),
  experience: jsonb("experience").$type<Experience[]>().notNull().default([]),
  projects: jsonb("projects").$type<Project[]>().notNull().default([]),
  resumeFileName: text("resume_file_name"),
  resumeUploaded: boolean("resume_uploaded").notNull().default(false),
  resumeParsedAt: timestamp("resume_parsed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export type CandidateProfileRow = typeof candidateProfile.$inferSelect

/**
 * Shared job catalogue. A job is public data (a demo listing or a real JSearch
 * result), so it is intentionally not owned by a single user — but every row
 * records who first persisted it. Assessments and applications reference it.
 */
export const job = pgTable("job", {
  id: text("id").primaryKey(),
  source: text("source").$type<"demo" | "jsearch" | "jobful" | "indianapi" | "recruiter">().notNull().default("demo"),
  title: text("title").notNull(),
  company: text("company").notNull().default(""),
  location: text("location").notNull().default(""),
  type: text("type").$type<Job["type"]>().notNull().default("Full-time"),
  experience: text("experience").notNull().default(""),
  salary: text("salary").notNull().default(""),
  requiredSkills: jsonb("required_skills").$type<string[]>().notNull().default([]),
  description: text("description").notNull().default(""),
  posted: text("posted").notNull().default(""),
  url: text("url"),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export type JobRow = typeof job.$inferSelect

/**
 * A candidate's relationship to a job: "saved" when they select it in the
 * discovery flow, "applied" once they explicitly apply. Always owned by the
 * authenticated candidate — one row per (candidate, job).
 */
export const application = pgTable(
  "application",
  {
    id: text("id").primaryKey(),
    candidateUserId: text("candidate_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    status: text("status").$type<"saved" | "applied" | "shortlisted" | "advanced" | "rejected">().notNull().default("saved"),
    /** Match score at the time of saving/applying, from computeMatch. */
    matchScore: integer("match_score"),
    candidateName: text("candidate_name"),
    candidateEmail: text("candidate_email"),
    phone: text("phone"),
    resumeText: text("resume_text"),
    resumeFileName: text("resume_file_name"),
    coverNote: text("cover_note"),
    portfolioUrl: text("portfolio_url"),
    aiShortlistRank: integer("ai_shortlist_rank"),
    aiShortlistScore: integer("ai_shortlist_score"),
    aiReasoning: text("ai_reasoning"),
    aiValidationPassed: boolean("ai_validation_passed").notNull().default(false),
    reviewNote: text("review_note"),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("application_candidate_job_unique").on(t.candidateUserId, t.jobId),
    index("application_candidate_idx").on(t.candidateUserId),
    index("application_job_idx").on(t.jobId),
    index("application_status_idx").on(t.status),
  ],
)

export type ApplicationRow = typeof application.$inferSelect

/**
 * A recruiter-authored assessment. Owned by the recruiter who created it;
 * candidates may only read rows whose status is "published".
 */
export const assessment = pgTable(
  "assessment",
  {
    id: text("id").primaryKey(),
    recruiterUserId: text("recruiter_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Denormalised for display so listings do not require a join.
    jobTitle: text("job_title").notNull().default(""),
    company: text("company").notNull().default(""),
    difficulty: text("difficulty").$type<Difficulty>().notNull().default("Medium"),
    status: text("status").$type<"draft" | "published">().notNull().default("draft"),
    questions: jsonb("questions").$type<AssessmentQuestion[]>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("assessment_recruiter_idx").on(t.recruiterUserId), index("assessment_status_idx").on(t.status)],
)

export type AssessmentRow = typeof assessment.$inferSelect

/**
 * A candidate's submission of an assessment. Grading, integrity and similarity
 * evidence are all computed server-side and stored here, so recruiter ranking
 * never depends on client-supplied scores.
 */
export const submission = pgTable(
  "submission",
  {
    id: text("id").primaryKey(),
    candidateUserId: text("candidate_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => assessment.id, { onDelete: "cascade" }),
    jobId: text("job_id").notNull(),
    // Denormalised display fields, captured at submit time.
    assessmentTitle: text("assessment_title").notNull().default(""),
    jobTitle: text("job_title").notNull().default(""),
    company: text("company").notNull().default(""),
    candidateName: text("candidate_name").notNull().default(""),
    result: jsonb("result").$type<AssessmentResult>().notNull(),
    /** Raw answers, kept so the Similarity Engine can compare later submissions. */
    answers: jsonb("answers").$type<Record<string, string>>().notNull().default({}),
    integrity: jsonb("integrity").$type<IntegrityResult>(),
    similarity: jsonb("similarity").$type<SimilarityResult>(),
    /** Interview evaluation, when the candidate also completed an AI interview. */
    interview: jsonb("interview").$type<Evaluation>(),
    /** Tagged as practice if taken freely without recruiter shortlisting/advancement */
    isPractice: boolean("is_practice").notNull().default(false),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  },
  (t) => [
    index("submission_candidate_idx").on(t.candidateUserId),
    index("submission_assessment_idx").on(t.assessmentId),
  ],
)

export type SubmissionRow = typeof submission.$inferSelect

/**
 * The recruiter's recorded outcome for a submission. Human-owned and never set
 * automatically. One row per submission, written only by the recruiter who owns
 * the parent assessment.
 */
export const hiringDecision = pgTable(
  "hiring_decision",
  {
    submissionId: text("submission_id")
      .primaryKey()
      .references(() => submission.id, { onDelete: "cascade" }),
    recruiterUserId: text("recruiter_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").$type<"shortlisted" | "advanced" | "rejected">().notNull(),
    note: text("note"),
    decidedAt: timestamp("decided_at").notNull().defaultNow(),
  },
  (t) => [index("hiring_decision_recruiter_idx").on(t.recruiterUserId)],
)

export type HiringDecisionRow = typeof hiringDecision.$inferSelect

/**
 * Face registration data for a candidate. Stores a face descriptor (128-d float array)
 * computed client-side via face-api.js. One row per user. The descriptor is treated
 * as sensitive biometric data and is never exposed through public APIs.
 */
export const faceRegistration = pgTable("face_registration", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** 128-dimensional face descriptor as a JSON array of floats. */
  faceDescriptor: jsonb("face_descriptor").$type<number[]>().notNull(),
  /** Whether liveness verification (smile + blink) passed at registration. */
  livenessVerified: boolean("liveness_verified").notNull().default(false),
  smileDetected: boolean("smile_detected").notNull().default(false),
  blinkDetected: boolean("blink_detected").notNull().default(false),
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
})

export type FaceRegistrationRow = typeof faceRegistration.$inferSelect

/** Types for the interview face analysis report stored as JSONB. */
export type FaceAnalysisEvent = {
  type: "face_match" | "face_mismatch" | "no_face" | "multiple_faces" | "gaze_away" | "gaze_toward" | "mouth_moving" | "mouth_still" | "camera_movement"
  timestamp: number  // seconds from interview start
  duration?: number  // seconds, for prolonged events
  details?: string
}

export type InterviewFaceReport = {
  /** Whether the registered face matched during the interview. */
  identityVerified: boolean
  /** Whether an identity mismatch was detected during the interview. */
  identityMismatchDetected?: boolean
  /** Whether multiple faces were detected in the video during the interview. */
  multipleFacesDetected?: boolean
  /** Whether sudden camera movement/shaking was detected during the interview. */
  cameraMovementDetected?: boolean
  /** Number of camera movement incidents recorded. */
  cameraMovementCount?: number
  /** Number of successful face match checks. */
  matchCount: number
  /** Number of face mismatch events. */
  mismatchCount: number
  /** Number of multiple-face events. */
  multipleFaceCount: number
  /** Number of face-not-visible events. */
  noFaceCount: number
  /** Approximate % of time facing camera (0-100). */
  gazeTowardPercent: number
  /** Approximate % of time looking away (0-100). */
  gazeAwayPercent: number
  /** Total count of all gaze-away / stare events. */
  gazeAwayCount: number
  /** Number of prolonged gaze-away events (>3s). */
  prolongedGazeAwayCount: number
  /** Approximate % of answer time with mouth movement detected. */
  mouthMovementPercent: number
  /** Periods with notable mouth activity. */
  speakingIntervals: { startSec: number; endSec: number }[]
  /** Periods with little/no visible mouth movement. */
  silentIntervals: { startSec: number; endSec: number }[]
  /** Detailed timeline events. */
  events: FaceAnalysisEvent[]
  /** Total analysis duration in seconds. */
  totalDurationSec: number
  /** When analysis was generated. */
  analyzedAt: string
  /** Whether vision identity verification passed prior to entering the interview room. */
  entryVerificationPassed?: boolean
  /** Timestamp when vision identity verification passed. */
  entryVerifiedAt?: string
  /** Base64 snapshot photo captured during vision identity verification or live interview. */
  entryPhoto?: string | null
  /** Live snapshot photo of interviewee captured during interview session. */
  intervieweePhoto?: string | null
  /** Candidate's registered reference photos (front, left, right). */
  registeredPhotos?: { front?: string | null; left?: string | null; right?: string | null } | null
  /** Identity match percentage across periodic checks. */
  matchPercentage?: number
  /** Audit alert or warning text for recruiter proctoring view. */
  proctoringAlert?: string | null
}

/**
 * Per-interview face analysis report. One row per submission.
 * Linked to the submission table for recruiter review.
 */
export const interviewFaceAnalysis = pgTable("interview_face_analysis", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id"),
  candidateUserId: text("candidate_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Full analysis report as JSONB. */
  report: jsonb("report").$type<InterviewFaceReport>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("ifa_candidate_idx").on(t.candidateUserId),
  index("ifa_submission_idx").on(t.submissionId),
])

export type InterviewFaceAnalysisRow = typeof interviewFaceAnalysis.$inferSelect

export type UserRole = "candidate" | "recruiter"

/**
 * In-app notifications for candidates (e.g. shortlisting, interview advancement, rejection).
 */
export const candidateNotification = pgTable("candidate_notification", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").$type<"shortlisted" | "advanced" | "rejected" | "info">().notNull().default("info"),
  jobTitle: text("job_title"),
  company: text("company"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("candidate_notification_user_idx").on(t.userId),
])

export type CandidateNotificationRow = typeof candidateNotification.$inferSelect

/**
 * Candidate study plan completion progress per week per job.
 */
export const candidateStudyProgress = pgTable(
  "candidate_study_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id").notNull(),
    week: integer("week").notNull(),
    completed: boolean("completed").notNull().default(false),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("candidate_study_progress_user_job_week_idx").on(t.userId, t.jobId, t.week),
    index("candidate_study_progress_user_idx").on(t.userId),
  ],
)

export type CandidateStudyProgressRow = typeof candidateStudyProgress.$inferSelect

