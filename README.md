# PrepSensei

> **Practice smarter. Interview confidently. Make hiring decisions with complete context.**

PrepSensei is an enterprise-grade AI-powered interview preparation, biometric verification, and recruitment platform. Built on Next.js 16 (App Router), React 19, Google Gemini 2.5, Better Auth, and PostgreSQL, it unifies realistic AI mock interviews, multi-angle biometric face verification, live proctoring integrity telemetry, resume ATS tailoring, skill-gap diagnostic roadmaps, and autonomous recruiter workflows into a fluid, Apple WWDC 2025 Liquid Glass interface.

[![Next.js](https://img.shields.io/badge/Next.js-16.3.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-orange?style=flat-square&logo=google)](https://ai.google.dev/)
[![Better Auth](https://img.shields.io/badge/Better_Auth-1.7.3-purple?style=flat-square)](https://www.better-auth.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45.2-green?style=flat-square)](https://orm.drizzle.team/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**Repository:** [github.com/gnandeep22/PrepSensei](https://github.com/gnandeep22/PrepSensei)

---

## Contents

- [Overview](#overview)
- [Key Features](#key-features)
  - [Candidate Experience](#candidate-experience)
  - [Recruiter Experience](#recruiter-experience)
  - [Design System & Motion](#design-system--motion)
- [System Architecture & Workflows](#system-architecture--workflows)
  - [1. Authentication & OTP Verification](#1-authentication--otp-verification)
  - [2. Multi-Angle Face Biometrics & Vision Sign-In](#2-multi-angle-face-biometrics--vision-sign-in)
  - [3. Conversational AI Mock Interview](#3-conversational-ai-mock-interview)
  - [4. Real-Time Proctoring & Integrity Telemetry](#4-real-time-proctoring--integrity-telemetry)
  - [5. Resume Parsing & ATS CV Tailor](#5-resume-parsing--ats-cv-tailor)
  - [6. Autonomous Recruiter Shortlisting Agent](#6-autonomous-recruiter-shortlisting-agent)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Setup & Installation](#local-setup--installation)
- [Environment Variables](#environment-variables)
- [Database Setup & Migrations](#database-setup--migrations)
- [Running the Application](#running-the-application)
- [Application Route Map](#application-route-map)
- [Privacy & Biometric Security](#privacy--biometric-security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

PrepSensei provides a dual-sided ecosystem connecting job seekers with hiring teams:

1. **Candidates** access an intelligent career co-pilot: practice technical and behavioral mock interviews with live voice synthesis, analyze skill gaps, generate custom 4-week study roadmaps, tailor resumes against target Job Descriptions, discover live Indian tech jobs, and track recruitment shortlisting in real-time.
2. **Recruiters** command an autonomous hiring portal: generate comprehensive JDs in seconds with Gemini AI, run multi-criteria RAG shortlisting across candidate pools, schedule official technical interviews, review candidate submissions alongside visual integrity telemetry, and deliver official hiring decisions with automated Gmail SMTP dispatch.

The entire frontend is engineered around an **Apple WWDC 2025 Liquid Glass & VisionOS Design System**, featuring translucent frosted glass panels with specular reflections, atmospheric ambient lighting refraction, smooth 120Hz-inspired spring physics, and an interactive collapsible sidebar rail.

---

## Key Features

### Candidate Experience

| Feature | Description |
|---|---|
| **Better Auth + Email OTP** | Secure email and password registration coupled with a 4-digit animated circular turntable OTP verification and Gmail SMTP delivery. |
| **Vision Face ID Sign-In** | Instant biometric passwordless sign-in with client-side 128-dimensional facial descriptor vector matching, anti-shake stability, and bouncy green tick verified animations. |
| **Multi-Angle Face Enrollment** | Mandatory 3-angle biometric capture (front, 45° left turn, 45° right turn) to establish an authentic baseline profile and eliminate interview impersonation. |
| **Conversational AI Mock Interview** | Dynamic AI mock interview tracks (Technical, Behavioral, HR) with real-time speech-to-text (STT), text-to-speech (TTS), and instant competency evaluation. |
| **Official Recruiter Interview** | Dedicated exam-style technical interview room linked to active job applications with persistent audio, timer, and integrity telemetry recording. |
| **Resume Parser & ATS Optimizer** | Instant text extraction from PDF and Word (`.docx`) files with ATS readability scoring and concrete keyword optimization tips. |
| **CV Tailor** | Deep alignment engine that rewrites bullet points and highlights missing requirements for specific target Job Descriptions. |
| **Diagnostic Skill-Gap Analyzer** | Comprehensive assessment measuring current skill proficiencies against target market roles with targeted recommendations. |
| **Personalized AI Study Plan** | Dynamic 4-week modular study roadmap breaking down high-priority topics into actionable daily milestones with checklist progress tracking. |
| **Live Job Discovery & Matching** | Search real-time market jobs with compatibility matching scores, salary intelligence, and one-click applications. |
| **Notifications & Updates Flyout** | Real-time recruitment notifications (shortlists, interview advances, decisions) anchored cleanly beside the navigation bar with unread badges. |

### Recruiter Experience

| Feature | Description |
|---|---|
| **Recruiter Mission Control** | High-level metrics tracking total vacancies, applicants, shortlisted talent, completed interviews, and average candidate scores. |
| **AI Job Creator** | Generates market-ready, structured Job Descriptions (roles, requirements, responsibilities, compensation) from simple prompts in seconds. |
| **Applicant Pipeline & Profiles** | Centralized applicant tracker with profile deep-dives, parsed resume view, match scores, and interview performance breakdowns. |
| **Autonomous Shortlisting Agent** | Multi-agent RAG workflow that reads candidate profiles, scores technical competency, and auto-generates ranked shortlist recommendations. |
| **Interview Integrity Telemetry** | Detailed visual analysis logs flagging multi-face presence, gaze diversion, absence from camera frame, and potential impersonation. |
| **Hiring Decision Dispatch** | Record official offers, interview advancements, or rejections with automated email delivery via Gmail SMTP and in-portal candidate alerts. |

### Design System & Motion

- **Apple WWDC 2025 Liquid Glass:** Layered translucent card surfaces with real-time saturation boost (`saturate-200%`), deep backdrop blur (`blur-3xl`), and multi-directional specular inner borders.
- **VisionOS Atmospheric Illumination:** Soft, multi-colored ambient orbs refract naturally through floating glass panels in both light and dark themes.
- **Collapsible Rail Navigation:** Toggle seamlessly between an expanded floating glass sidebar (`w-72`) and a minimalist Apple-inspired compact rail (`w-18`), with smooth main content area expansion (`lg:pl-72` to `lg:pl-28`) persisted via `localStorage`.
- **Protected Orbital OTP Turntable:** Proprietary 4-digit circular spinning turntable physics that curls into an emerald aura verified tile upon successful code entry.

---

## System Architecture & Workflows

### 1. Authentication & OTP Verification

```mermaid
flowchart TD
    A[Candidate Enters Email & Details] --> B[POST /api/auth/otp action:send]
    B --> C[Generate Secure 4-Digit Code]
    C --> D[Dispatch via Gmail SMTP / Nodemailer]
    D --> E[User Receives Email Code]
    E --> F[Enter Code on Orbital Turntable UI]
    F --> G[POST /api/auth/otp action:verify]
    G -- Valid --> H[Trigger Orbital Verified Pop & Transition to Step 2]
    G -- Invalid --> I[Spring Shake Animation & Display Error]
```

### 2. Multi-Angle Face Biometrics & Vision Sign-In

```mermaid
flowchart TD
    A[Camera Stream Activated] --> B[Load SSD MobileNet & 68-Point Landmark Models]
    B --> C[Fit Face Inside Central Dotted Oval Guide]
    C --> D{Motion or Shaking Detected?}
    D -- Yes --> E[Display Steady Device Warning]
    D -- No --> F[Extract 128-D Biometric Vector]
    F --> G[Gather 3 Consecutive Stable Frames]
    G --> H[POST /api/face action:login]
    H --> I[Euclidean Distance Matching vs Enrolled Baseline]
    I -- Distance < 0.52 --> J[Display Bouncy Green Tick Verified Pop]
    J --> K[Set Session Cookie & Open Candidate Dashboard]
    I -- No Match --> L[Increment Failed Counter & Prompt Retry]
```

### 3. Conversational AI Mock Interview

```mermaid
flowchart TD
    A[Select Interview Track: Technical, Behavioral, HR] --> B[Initialize Camera & Audio Permissions]
    B --> C[Fetch Tailored Question via Google Gemini API]
    C --> D[Read Question via Speech Synthesis TTS]
    D --> E[Candidate Speaks Response via Web Speech STT]
    E --> F[Display Live Audio Equalizer & Real-Time Waveform]
    F --> G[Submit Response to POST /api/interview]
    G --> H[Gemini Evaluates Technical Depth, Clarity & Tone]
    H --> I[Display Dynamic Metric Scores & Constructive Feedback]
    I --> J{Final Question?}
    J -- No --> C
    J -- Yes --> K[Generate Comprehensive Session Report]
```

### 4. Real-Time Proctoring & Integrity Telemetry

```mermaid
flowchart TD
    A[Active Interview Video Stream] --> B[Background Visual Processing 200ms Interval]
    B --> C[Check Face Count]
    C -- 0 Faces --> D[Log Integrity Event: Candidate Left Camera]
    C -- >1 Faces --> E[Log Integrity Event: Multiple Persons Detected]
    C -- 1 Face --> F[Calculate Pitch, Yaw & Eye Aspect Ratio]
    F -- Looking Away >3s --> G[Log Integrity Event: Gaze Diverted]
    F -- Centered & Attentive --> H[Maintain Continuous Positive Integrity Score]
    D & E & G --> I[Record Event in Recruiter Integrity Report]
```

### 5. Resume Parsing & ATS CV Tailor

```mermaid
flowchart LR
    A[Upload PDF or Word Document] --> B[pdf-parse / Mammoth Text Extraction]
    B --> C[Structure Work Experience, Skills & Education]
    C --> D[POST /api/cv-tailor with Target Job Description]
    D --> E[Gemini Compares Keyword Coverage & Semantics]
    E --> F[Generate ATS Match % Score]
    E --> G[Highlight Missing Keywords & Bullet Point Revisions]
```

### 6. Autonomous Recruiter Shortlisting Agent

```mermaid
flowchart TD
    A[Recruiter Selects Job Posting] --> B[POST /api/recruiter/shortlist-agent]
    B --> C[Agent Fetches All Candidate Applications & Resumes]
    C --> D[Gemini Analyzes Skill Alignment & Experience Fit]
    D --> E[Rank Candidates: Top Match / Strong / Consider / Reject]
    E --> F[Generate Written Justification for Each Recommendation]
    F --> G[Recruiter Reviews Ranked Leaderboard]
    G --> H[1-Click Batch Advance to Technical Interview]
```

---

## Technology Stack

| Layer | Technologies | Purpose |
|---|---|---|
| **Core Framework** | Next.js 16.3.3 (App Router), React 19.0.0 | High-performance full-stack web application framework with Turbopack |
| **Language & Tooling** | TypeScript 5.7.3, pnpm 12.6.0 | Strict type safety, clean code patterns, and deterministic dependency resolution |
| **Styling & System** | Tailwind CSS v4, PostCSS, `@tailwindcss/postcss` | Modern CSS engine with custom VisionOS and WWDC 2025 Liquid Glass styling |
| **UI Primitives** | Base UI (`@base-ui/react`), Lucide React | Accessible headless components and iconography |
| **Motion & Animation** | Motion for React (`motion` v14.4), Custom Keyframe Physics | 120Hz-tuned fluid spring transitions and protected orbital physics |
| **AI Engine** | Vercel AI SDK (`ai` v7), `@ai-sdk/google` (Gemini 2.5) | Low-latency question generation, feedback evaluation, and RAG shortlisting |
| **Client-Side Biometrics** | `@vladmandic/face-api` (v1.7.15) | SSD MobileNet v1 face detection, 68-point facial landmarks, and 128-D descriptors |
| **Authentication** | Better Auth (v1.7.3) | Secure session management, role cookies, and credential verification |
| **Database & ORM** | PostgreSQL 16 (`pg` v8), Drizzle ORM (v0.45) | Relational database schema with end-to-end type safety |
| **Email Delivery** | Nodemailer (v10.0.10) | Automated Gmail SMTP OTP codes and official decision dispatch |
| **Document Processing** | `pdf-parse` (v2.4), `mammoth` (v1.12), `pdfkit` | Server-side parsing and generation of PDF and Word document assets |

---

## Project Structure

```text
PrepSensei/
├── app/                             # Next.js App Router (46 routes)
│   ├── api/                         # Backend API route handlers
│   │   ├── assessment/              # Assessment evaluation endpoints
│   │   ├── auth/                    # Better Auth and OTP endpoints
│   │   │   ├── [...all]/            # Better Auth catch-all handlers
│   │   │   └── otp/                 # Send and verify email OTP codes
│   │   ├── candidate/               # Candidate real-time notification endpoints
│   │   ├── cv-tailor/               # AI CV tailoring and keyword optimizer
│   │   ├── face/                    # Biometric enrollment and vision login
│   │   │   └── analysis/            # Live proctoring and integrity telemetry
│   │   ├── interview/               # Gemini live mock interview engine
│   │   ├── jobs/                    # Market job search and applications
│   │   ├── profile/                 # Profile and identity updates
│   │   ├── recruiter/               # Recruiter operations
│   │   │   ├── applications/        # Candidate application pipeline
│   │   │   ├── decision/            # Hiring decision dispatch
│   │   │   ├── generate-job/        # AI job description generator
│   │   │   ├── jobs/                # Recruiter job vacancy management
│   │   │   ├── publish-job/         # Live job publishing
│   │   │   └── shortlist-agent/     # Autonomous candidate ranking agent
│   │   ├── resume/                  # Resume parsing and ATS analysis
│   │   ├── skill-gap/               # Skill-gap diagnostics
│   │   ├── stt/                     # Speech-to-text audio transcription
│   │   ├── study-plan/              # Personalized study roadmap generator
│   │   ├── submissions/             # Assessment submission review
│   │   └── tts/                     # Text-to-speech voice synthesis
│   ├── assessment/                  # Candidate assessment interface
│   ├── cv-tailor/                   # Dedicated CV tailoring workspace
│   ├── how-it-works/                # AI and biometric vision architecture guide
│   ├── interview/                   # Interactive AI mock interview simulator
│   │   └── official/                # Official recruiter-scheduled technical interview
│   ├── jobs/                        # Real-time job search and application portal
│   ├── matches/                     # Candidate job matching leaderboard
│   ├── profile/                     # Candidate biometrics and profile management
│   ├── recruiter/                   # Recruiter portal
│   │   ├── assessments/             # Recruiter assessment grading
│   │   ├── candidates/              # Applicant profiles and integrity reports
│   │   ├── job-creator/             # AI JD generation workspace
│   │   ├── jobs/                    # Active vacancy manager
│   │   └── results/                 # Candidate scorecard and decision dispatch
│   ├── resume/                      # Resume ATS analyzer and CV builder
│   ├── sign-in/                     # Sign-in UI (Password & Face ID Vision)
│   ├── sign-up/                     # Registration & 3-angle biometric enrollment
│   ├── skill-gap/                   # Diagnostic skill-gap dashboard
│   ├── study-plan/                  # 4-Week AI modular study plan
│   ├── verify-otp/                  # Protected 4-digit orbital OTP verification
│   ├── globals.css                  # Apple Liquid Glass design tokens and styles
│   └── layout.tsx                   # Root layout with font and ambient illumination
├── components/                      # Modular UI components
│   ├── app-shell.tsx                # Dynamic AppShell with VisionOS ambient lighting
│   ├── auth/                        # Auth forms and protected OTP verification card
│   ├── candidate/                   # Real-time notifications flyout and bell
│   ├── face/                        # FaceVerification, camera guide, and reports
│   ├── interview/                   # AI interviewer video, live waveforms, and timers
│   ├── navigation/                  # SidebarNav with WWDC25 collapsible rail
│   ├── recruiter/                   # Recruiter modals, shortlist agents, and charts
│   ├── shared.tsx                   # Standardized StatCards and page headers
│   └── ui/                          # Radix/Base UI accessible primitives (Card, Button, Dialog)
├── lib/                             # Shared business logic and utilities
│   ├── ai/                          # Google Gemini model initializers
│   ├── auth.ts                      # Server-side Better Auth configuration
│   ├── auth-client.ts               # Client-side authentication hooks
│   ├── db/                          # Drizzle ORM schema, connection, and migrations
│   │   └── schema.ts                # PostgreSQL tables, relations, and indices
│   ├── face/                        # Face API hooks, landmark math, and descriptor logic
│   ├── jobs/                        # Job search and third-party API adapters
│   └── utils.ts                     # Utility helpers and cn class merger
├── public/                          # Static web assets
│   ├── companies/                   # Enterprise company brand icons
│   └── models/                      # Offline face-api weights, bins, and manifests
├── scripts/                         # Operational helper scripts
│   ├── db-migrate.mjs               # Database schema migration runner
│   └── db-view.mjs                  # Interactive terminal database inspection tool
├── .env.example                     # Sanitized environment variable template
├── .gitignore                       # Production Git ignore rules
├── next.config.mjs                  # Next.js configuration
├── package.json                     # Project manifest and dependencies
├── pnpm-lock.yaml                   # Deterministic pnpm lockfile
├── tsconfig.json                    # TypeScript strict compiler configuration
└── README.md                        # Project documentation
```

---

## Prerequisites

Before setting up PrepSensei locally, ensure your environment has:

1. **Node.js**: `v20.18.0` or higher (tested with `v20.x`, `v22.x`, and `v26.x`).
2. **pnpm**: `v9.0.0` or higher (installed via Corepack: `corepack enable && corepack prepare pnpm@latest --activate`).
3. **PostgreSQL**: `v15` or higher running locally or accessible remotely.
4. **Google Gemini API Key**: Free or paid key from [Google AI Studio](https://aistudio.google.com/).
5. **Modern Browser**: Google Chrome or Microsoft Edge recommended for WebGL hardware acceleration, camera stream, and Web Speech API capabilities.

---

## Local Setup & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/gnandeep22/PrepSensei.git
cd PrepSensei
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Local Environment Variables

Copy the sanitized template to `.env.local`:

```bash
cp .env.example .env.local
```

Open `.env.local` in your editor and configure the values (see [Environment Variables](#environment-variables)).

### 4. Initialize PostgreSQL Database

Ensure PostgreSQL is running and create the database:

```bash
# Using PostgreSQL CLI
createdb prepsensei
```

Verify that your `DATABASE_URL` in `.env.local` reflects your local database username and password.

### 5. Run Database Migrations

Push the Drizzle ORM schema to your PostgreSQL instance:

```bash
pnpm db:migrate
```

*Optional:* Verify that tables (`user`, `session`, `candidate_profile`, `job`, `application`, `candidate_notification`, etc.) were created:

```bash
pnpm db:view
```

### 6. Start the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

All sensitive values must be declared in `.env.local`. **Never commit `.env.local` to Git.**

| Variable | Description | Example / Default | Required |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection URI | `postgresql://postgres:postgres@localhost:5432/prepsensei` | **Yes** |
| `BETTER_AUTH_SECRET` | 32+ character random secret for signing authentication sessions | `openssl rand -hex 32` | **Yes** |
| `BETTER_AUTH_URL` | Base canonical application URL | `http://localhost:3000` | **Yes** |
| `GEMINI_API_KEY` | Google AI Studio Gemini API key | `AIzaSy...` | **Yes** |
| `INDIANAPI_KEY` | Optional API key for live Indian tech job notifications | `ind_live_...` | Optional |
| `SMTP_USER` | Gmail address for sending verification OTPs & recruiter decisions | `your-email@gmail.com` | Optional |
| `SMTP_PASS` | 16-character Google App Password (not your personal password) | `abcd efgh ijkl mnop` | Optional |
| `JOBFUL_API_URL` | Endpoint for standalone Jobful job aggregator service | `http://localhost:5000` | Optional |

---

## Database Setup & Migrations

The database is built on PostgreSQL and managed via Drizzle ORM in [`lib/db/schema.ts`](file:///home/gnandeep/lib/db/schema.ts).

### Running Migrations

To apply schema changes to your database:

```bash
pnpm db:migrate
```

### Inspecting Database State

To inspect total registered candidates, active job postings, application submissions, and integrity records from the terminal:

```bash
pnpm db:view
```

---

## Running the Application

| Command | Action |
|---|---|
| `pnpm dev` | Starts local Next.js development server with Turbopack on `http://localhost:3000` |
| `pnpm build` | Compiles optimized Next.js production build across all 46 static and dynamic routes |
| `pnpm start` | Launches production server on `http://localhost:3000` |
| `pnpm db:migrate` | Executes database migration script using credentials in `.env.local` |
| `pnpm db:view` | Displays an interactive terminal view of tables, records, and database counts |

---

## Application Route Map

### Candidate Portal

- [`/`](http://localhost:3000/) — Candidate home portal with performance metrics, quick actions, and recommended jobs.
- [`/sign-in`](http://localhost:3000/sign-in) — Unified sign-in with email/password and Face ID Vision login.
- [`/sign-up`](http://localhost:3000/sign-up) — Account registration with mandatory 3-angle biometric face enrollment.
- [`/verify-otp`](http://localhost:3000/verify-otp) — Protected 4-digit orbital turntable verification page.
- [`/interview`](http://localhost:3000/interview) — AI mock interview simulator with camera proctoring, live voice, and instant feedback.
- [`/interview/official`](http://localhost:3000/interview/official) — Official technical interview room linked to active recruiter applications.
- [`/assessment`](http://localhost:3000/assessment) — Technical quizzes, system design, and coding assessments.
- [`/resume`](http://localhost:3000/resume) — PDF/Word resume parser with ATS scoring and improvement recommendations.
- [`/cv-tailor`](http://localhost:3000/cv-tailor) — Tailor candidate CVs directly against any target Job Description.
- [`/skill-gap`](http://localhost:3000/skill-gap) — Interactive skill-gap diagnostic matrix with level recommendations.
- [`/study-plan`](http://localhost:3000/study-plan) — Personalized 4-week AI study roadmap with daily checklists.
- [`/jobs`](http://localhost:3000/jobs) — Search real-time market jobs with Indian market notifications.
- [`/matches`](http://localhost:3000/matches) — AI job match analysis and compatibility leaderboard.
- [`/profile`](http://localhost:3000/profile) — Candidate identity, enrolled biometrics, and activity history.
- [`/how-it-works`](http://localhost:3000/how-it-works) — Guide to platform AI, vision proctoring, and interview evaluation.

### Recruiter Portal

- [`/recruiter`](http://localhost:3000/recruiter) — Recruiter dashboard tracking candidate pipelines, vacancies, and metrics.
- [`/recruiter/jobs`](http://localhost:3000/recruiter/jobs) — Active job vacancy management and applicant review.
- [`/recruiter/job-creator`](http://localhost:3000/recruiter/job-creator) — AI-assisted Job Description generator.
- [`/recruiter/candidates`](http://localhost:3000/recruiter/candidates) — Candidate applicant pool with resume screening and filter tools.
- [`/recruiter/assessments`](http://localhost:3000/recruiter/assessments) — Candidate assessment scores and submission logs.
- [`/recruiter/results`](http://localhost:3000/recruiter/results) — Candidate evaluation scorecards, visual integrity reports, and hiring decision dispatch.

---

## Privacy & Biometric Security

PrepSensei treats user biometrics, camera feeds, and personal resumes with high security standards:

1. **Client-Side Vector Computation**: Video frames are processed locally inside the user's browser using `@vladmandic/face-api` (WebGL/WASM). Raw camera video frames are never streamed to or stored on external servers.
2. **Encrypted Biometric Descriptors**: Only normalized 128-dimensional floating-point Euclidean descriptors are stored in PostgreSQL to verify identity during interviews and logins.
3. **Liveness & Anti-Spoofing**: Detection algorithms measure eye-aspect ratios (blink detection), multi-angle head yaw/pitch, and bounding-box jitter to prevent photographic or video replay attacks.
4. **Advisory Proctoring Signals**: Gaze diversion, face absence, and multi-face detections are flagged strictly as advisory review items for human recruiters. They are not automated disqualifications.

---

## Troubleshooting

### Database connection failed (`ECONNREFUSED` or `database does not exist`)
- Ensure PostgreSQL is active: `sudo systemctl status postgresql` (Linux) or check your PostgreSQL service.
- Verify the database exists: run `createdb prepsensei` or connect with `psql -U postgres` and run `CREATE DATABASE prepsensei;`.
- Verify your password and user permissions in `.env.local`.

### Google Gemini API returns 403 or quota errors
- Check that `GEMINI_API_KEY` is present and active in `.env.local`.
- Ensure your Google AI Studio project has access to `gemini-2.5-flash` or `gemini-1.5-pro`.

### Camera / Microphone access blocked
- Open browser settings (`chrome://settings/content/camera`) and grant permission to `http://localhost:3000`.
- Ensure no other application (e.g. Zoom, Teams) has locked the camera device.

### Face-api model files fail to load
- Verify that `public/models/` contains the `.bin` and manifest JSON files for SSD MobileNet, Landmark 68, and Face Recognition models.

---

## Contributing

1. Fork the repository: [github.com/gnandeep22/PrepSensei](https://github.com/gnandeep22/PrepSensei).
2. Create your feature branch: `git checkout -b feature/amazing-feature`.
3. Commit your changes: `git commit -m "feat: implement awesome feature"`.
4. Push to the branch: `git push origin feature/amazing-feature`.
5. Open a Pull Request.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

**PrepSensei** — *Empowering candidates to interview with confidence, enabling hiring teams to recruit with clarity.*
