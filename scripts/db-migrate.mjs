import net from "node:net"
import dns from "node:dns"

if (typeof net.setDefaultAutoSelectFamily === "function") {
  net.setDefaultAutoSelectFamily(false)
}
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first")
}

import { Pool } from "pg"

const sql = `
create table if not exists "user" (
  "id" text primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null default false,
  "image" text,
  "role" text not null default 'candidate',
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now()
);

create table if not exists "session" (
  "id" text primary key,
  "expiresAt" timestamp not null,
  "token" text not null unique,
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user"("id") on delete cascade
);

create table if not exists "account" (
  "id" text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user"("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope" text,
  "password" text,
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now()
);

create table if not exists "verification" (
  "id" text primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamp not null,
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now()
);

-- Phase 1: candidate profile + resume, owned by the authenticated user.
create table if not exists "candidate_profile" (
  "user_id" text primary key references "user"("id") on delete cascade,
  "name" text not null default '',
  "title" text not null default '',
  "email" text not null default '',
  "phone" text not null default '',
  "location" text not null default '',
  "summary" text not null default '',
  "skills" jsonb not null default '[]'::jsonb,
  "education" jsonb not null default '[]'::jsonb,
  "experience" jsonb not null default '[]'::jsonb,
  "projects" jsonb not null default '[]'::jsonb,
  "resume_file_name" text,
  "resume_uploaded" boolean not null default false,
  "resume_parsed_at" timestamp,
  "created_at" timestamp not null default now(),
  "updated_at" timestamp not null default now()
);

-- Phase 2: shared job catalogue (demo listings + real JSearch results).
create table if not exists "job" (
  "id" text primary key,
  "source" text not null default 'demo',
  "title" text not null,
  "company" text not null default '',
  "location" text not null default '',
  "type" text not null default 'Full-time',
  "experience" text not null default '',
  "salary" text not null default '',
  "required_skills" jsonb not null default '[]'::jsonb,
  "description" text not null default '',
  "posted" text not null default '',
  "url" text,
  "created_by" text references "user"("id") on delete set null,
  "created_at" timestamp not null default now(),
  "updated_at" timestamp not null default now()
);

-- Candidate applications, owned by the candidate. One row per (candidate, job).
create table if not exists "application" (
  "id" text primary key,
  "candidate_user_id" text not null references "user"("id") on delete cascade,
  "job_id" text not null references "job"("id") on delete cascade,
  "status" text not null default 'saved',
  "match_score" integer,
  "created_at" timestamp not null default now(),
  "updated_at" timestamp not null default now()
);
create unique index if not exists "application_candidate_job_unique"
  on "application" ("candidate_user_id", "job_id");
create index if not exists "application_candidate_idx" on "application" ("candidate_user_id");

-- Ensure all extended columns exist for application tracking and AI shortlisting
alter table "application" add column if not exists "candidate_name" text;
alter table "application" add column if not exists "candidate_email" text;
alter table "application" add column if not exists "phone" text;
alter table "application" add column if not exists "resume_text" text;
alter table "application" add column if not exists "resume_file_name" text;
alter table "application" add column if not exists "cover_note" text;
alter table "application" add column if not exists "portfolio_url" text;
alter table "application" add column if not exists "ai_shortlist_rank" integer;
alter table "application" add column if not exists "ai_shortlist_score" integer;
alter table "application" add column if not exists "ai_reasoning" text;
alter table "application" add column if not exists "ai_validation_passed" boolean not null default false;
alter table "application" add column if not exists "review_note" text;
alter table "application" add column if not exists "decided_at" timestamp;

-- Tag interview submissions as official (shortlisted/advanced) vs practice
alter table "submission" add column if not exists "is_practice" boolean not null default false;


-- Recruiter-authored assessments, owned by the recruiter.
create table if not exists "assessment" (
  "id" text primary key,
  "recruiter_user_id" text not null references "user"("id") on delete cascade,
  "job_id" text not null references "job"("id") on delete cascade,
  "title" text not null,
  "job_title" text not null default '',
  "company" text not null default '',
  "difficulty" text not null default 'Medium',
  "status" text not null default 'draft',
  "questions" jsonb not null default '[]'::jsonb,
  "created_at" timestamp not null default now(),
  "updated_at" timestamp not null default now()
);
create index if not exists "assessment_recruiter_idx" on "assessment" ("recruiter_user_id");
create index if not exists "assessment_status_idx" on "assessment" ("status");

-- Candidate submissions. Grading/integrity/similarity are computed server-side.
create table if not exists "submission" (
  "id" text primary key,
  "candidate_user_id" text not null references "user"("id") on delete cascade,
  "assessment_id" text not null references "assessment"("id") on delete cascade,
  "job_id" text not null,
  "assessment_title" text not null default '',
  "job_title" text not null default '',
  "company" text not null default '',
  "candidate_name" text not null default '',
  "result" jsonb not null,
  "answers" jsonb not null default '{}'::jsonb,
  "integrity" jsonb,
  "similarity" jsonb,
  "interview" jsonb,
  "submitted_at" timestamp not null default now()
);
create index if not exists "submission_candidate_idx" on "submission" ("candidate_user_id");
create index if not exists "submission_assessment_idx" on "submission" ("assessment_id");

-- Recruiter hiring decisions. One row per submission, human-owned.
create table if not exists "hiring_decision" (
  "submission_id" text primary key references "submission"("id") on delete cascade,
  "recruiter_user_id" text not null references "user"("id") on delete cascade,
  "status" text not null,
  "note" text,
  "decided_at" timestamp not null default now()
);
create index if not exists "hiring_decision_recruiter_idx" on "hiring_decision" ("recruiter_user_id");

-- Face registration for candidates (biometric, one per user).
create table if not exists "face_registration" (
  "user_id" text primary key references "user"("id") on delete cascade,
  "face_descriptor" jsonb not null,
  "liveness_verified" boolean not null default false,
  "smile_detected" boolean not null default false,
  "blink_detected" boolean not null default false,
  "registered_at" timestamp not null default now()
);

-- Interview face analysis reports, one per interview/submission.
create table if not exists "interview_face_analysis" (
  "id" text primary key,
  "submission_id" text,
  "candidate_user_id" text not null references "user"("id") on delete cascade,
  "report" jsonb not null,
  "created_at" timestamp not null default now()
);
create index if not exists "ifa_candidate_idx" on "interview_face_analysis" ("candidate_user_id");
create index if not exists "ifa_submission_idx" on "interview_face_analysis" ("submission_id");

-- In-app notifications for candidates.
create table if not exists "candidate_notification" (
  "id" text primary key,
  "user_id" text not null references "user"("id") on delete cascade,
  "title" text not null,
  "message" text not null,
  "type" text not null default 'info',
  "job_title" text,
  "company" text,
  "read" boolean not null default false,
  "created_at" timestamp not null default now()
);
create index if not exists "candidate_notification_user_idx" on "candidate_notification" ("user_id");

-- Candidate study plan progress.
create table if not exists "candidate_study_progress" (
  "id" text primary key,
  "user_id" text not null references "user"("id") on delete cascade,
  "job_id" text not null,
  "week" integer not null,
  "completed" boolean not null default false,
  "updated_at" timestamp not null default now()
);
create unique index if not exists "candidate_study_progress_user_job_week_idx" on "candidate_study_progress" ("user_id", "job_id", "week");
create index if not exists "candidate_study_progress_user_idx" on "candidate_study_progress" ("user_id");
`

const connectionString = (process.env.DATABASE_URL || "").replace("sslmode=require", "sslmode=verify-full")
const pool = new Pool({
  connectionString,
  stream: () => {
    const s = new net.Socket()
    const origConnect = s.connect.bind(s)
    s.connect = function (port, host, cb) {
      if (typeof port === "object") {
        return origConnect({ ...port, family: 4, autoSelectFamily: false }, host)
      }
      return origConnect({ port, host, family: 4, autoSelectFamily: false }, cb)
    }
    return s
  },
})
await pool.query(sql)
const { rows } = await pool.query(
  `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
)
console.log("public tables:", rows.map((r) => r.table_name).join(", "))
await pool.end()

