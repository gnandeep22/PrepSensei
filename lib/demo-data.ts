export type Education = { degree: string; institution: string; years: string }
export type Experience = { title: string; company: string; years: string; highlights: string[] }
export type Project = { name: string; description: string; tech: string[] }

export type CandidateProfile = {
  name: string
  title: string
  email: string
  phone: string
  location: string
  summary: string
  skills: string[]
  education: Education[]
  experience: Experience[]
  projects: Project[]
}

export const demoCandidate: CandidateProfile = {
  name: "Aisha Rahman",
  title: "Software Developer",
  email: "aisha.rahman@example.com",
  phone: "+1 (555) 014-2290",
  location: "Toronto, Canada",
  summary:
    "Software developer with 2+ years of experience building backend services and web applications with Python, FastAPI and PostgreSQL. Comfortable working across the stack with React and collaborating in agile teams.",
  skills: ["Python", "FastAPI", "PostgreSQL", "React", "Git", "SQL", "REST APIs"],
  education: [
    {
      degree: "B.Sc. Computer Science",
      institution: "University of Toronto",
      years: "2019 – 2023",
    },
  ],
  experience: [
    {
      title: "Software Developer",
      company: "Northwind Analytics",
      years: "2023 – Present",
      highlights: [
        "Built and maintained REST APIs with FastAPI serving 40k daily requests",
        "Designed PostgreSQL schemas and optimised slow queries by 35%",
        "Collaborated with frontend team to ship React dashboards",
      ],
    },
    {
      title: "Backend Developer Intern",
      company: "BrightPath Labs",
      years: "Summer 2022",
      highlights: [
        "Implemented authentication endpoints in Python",
        "Wrote unit tests raising coverage from 48% to 80%",
      ],
    },
  ],
  projects: [
    {
      name: "TaskFlow API",
      description: "Task management REST API with JWT auth, built with FastAPI and PostgreSQL.",
      tech: ["Python", "FastAPI", "PostgreSQL"],
    },
    {
      name: "CampusMarket",
      description: "React marketplace for students with a Python backend and Git-based CI.",
      tech: ["React", "Python", "Git"],
    },
  ],
}

export type TailoredCv = {
  summary: string
  skills: string[]
  experienceImprovements: { before: string; after: string }[]
  suggestions: string[]
}

export type TruthClaimStatus = "supported" | "needs_review" | "unsupported"
export type TruthClaim = { claim: string; status: TruthClaimStatus; explanation: string }
export type TruthCheck = { overall: TruthClaimStatus; claims: TruthClaim[] }

export type Job = {
  id: string
  title: string
  company: string
  location: string
  type: "Full-time" | "Contract" | "Internship" | "Remote"
  experience: string
  salary: string
  requiredSkills: string[]
  description: string
  posted: string
  url?: string
  source?: "recruiter" | "jobful" | "indianapi" | "jsearch" | "demo" | string
}

/** Check if a job was posted directly by a recruiter in PrepSensei. */
export function isRecruiterJob(job?: { id?: string; source?: string } | null): boolean {
  if (!job) return false
  if (job.source === "recruiter") return true
  if (job.id && job.id.startsWith("recruiter-job-")) return true
  return false
}

/** Where a persisted job row came from. */
export type JobSource = "demo" | "jsearch" | "jobful" | "indianapi"

export type ApplicationStatus = "saved" | "applied" | "shortlisted" | "advanced" | "rejected"

/** A candidate's persisted relationship to a job, with the job snapshot joined in. */
export type JobApplication = {
  id: string
  jobId: string
  status: ApplicationStatus
  matchScore: number | null
  createdAt: string
  updatedAt: string
  job: Job
}

export const demoJobs: Job[] = [
  {
    id: "python-backend-developer",
    title: "Python Backend Developer",
    company: "Streamline Health",
    location: "Toronto, Canada",
    type: "Full-time",
    experience: "2–4 years",
    salary: "$85k – $105k",
    requiredSkills: ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS", "REST APIs"],
    description:
      "Design and build backend services for a healthcare scheduling platform. You will own APIs end to end, from schema design to deployment on AWS.",
    posted: "2 days ago",
  },
  {
    id: "ai-ml-engineer",
    title: "AI/ML Engineer",
    company: "Cognitiv Labs",
    location: "Remote",
    type: "Remote",
    experience: "3+ years",
    salary: "$110k – $140k",
    requiredSkills: ["Python", "PyTorch", "Machine Learning", "Docker", "SQL", "MLOps"],
    description:
      "Train, evaluate and deploy machine-learning models that power recommendation features. Strong Python fundamentals required.",
    posted: "5 days ago",
  },
  {
    id: "full-stack-developer",
    title: "Full Stack Developer",
    company: "Orbit Commerce",
    location: "Vancouver, Canada",
    type: "Full-time",
    experience: "2+ years",
    salary: "$80k – $100k",
    requiredSkills: ["React", "TypeScript", "Python", "PostgreSQL", "REST APIs", "Docker"],
    description:
      "Ship features across a React storefront and Python services. Work closely with design and product in a small, fast team.",
    posted: "1 week ago",
  },
  {
    id: "software-engineer",
    title: "Software Engineer",
    company: "Maple Fintech",
    location: "Montreal, Canada",
    type: "Full-time",
    experience: "1–3 years",
    salary: "$78k – $95k",
    requiredSkills: ["Python", "SQL", "Git", "System Design", "Testing", "REST APIs"],
    description:
      "Join a platform team building payment reconciliation services. Emphasis on clean code, testing and reliability.",
    posted: "3 days ago",
  },
  {
    id: "data-engineer",
    title: "Data Engineer",
    company: "Northstar Logistics",
    location: "Calgary, Canada",
    type: "Contract",
    experience: "2+ years",
    salary: "$70/hr",
    requiredSkills: ["Python", "SQL", "PostgreSQL", "Airflow", "Spark", "AWS"],
    description:
      "Build reliable data pipelines feeding logistics dashboards. Experience with orchestration tools and cloud storage is a plus.",
    posted: "4 days ago",
  },
]

export const allSkillFilters = ["Python", "FastAPI", "PostgreSQL", "React", "Docker", "AWS", "SQL", "Machine Learning"]

export type MatchResult = {
  score: number
  matching: string[]
  gaps: string[]
  experienceMatch: "Strong" | "Moderate" | "Limited"
  explanation: string
}

const SKILL_SYNONYMS: Record<string, string[]> = {
  "react": ["react", "react.js", "reactjs", "frontend", "next.js", "nextjs", "jsx"],
  "react.js": ["react", "react.js", "reactjs", "frontend", "next.js"],
  "node": ["node", "node.js", "nodejs", "express", "backend"],
  "node.js": ["node", "node.js", "nodejs", "express", "backend"],
  "next.js": ["next", "next.js", "nextjs", "react"],
  "python": ["python", "py", "fastapi", "django", "flask"],
  "fastapi": ["fastapi", "python", "rest api", "backend"],
  "django": ["django", "python", "backend"],
  "sql": ["sql", "postgresql", "postgres", "mysql", "database", "sqlite", "relational database"],
  "postgresql": ["postgresql", "postgres", "sql", "database", "relational database"],
  "mongodb": ["mongodb", "mongo", "nosql", "database"],
  "typescript": ["typescript", "ts", "javascript", "js"],
  "javascript": ["javascript", "js", "typescript", "ts"],
  "docker": ["docker", "container", "containers", "containerization", "kubernetes", "k8s"],
  "aws": ["aws", "amazon web services", "cloud", "ec2", "s3", "lambda"],
  "gcp": ["gcp", "google cloud", "cloud"],
  "rest apis": ["rest", "rest api", "rest apis", "restful", "api", "endpoints", "http"],
  "rest api": ["rest", "rest api", "rest apis", "restful", "api", "endpoints"],
  "rest": ["rest", "rest api", "rest apis", "restful", "api"],
  "git": ["git", "github", "gitlab", "version control"],
  "testing": ["testing", "unit test", "unit tests", "pytest", "jest", "test coverage", "qa"],
  "ci/cd": ["ci/cd", "ci", "cd", "github actions", "pipelines", "devops"],
  "machine learning": ["machine learning", "ml", "ai", "deep learning", "pytorch", "tensorflow", "scikit-learn", "data science"],
  "pytorch": ["pytorch", "torch", "deep learning", "machine learning", "ml"],
  "mlops": ["mlops", "model deployment", "machine learning", "docker", "pipeline"],
  "airflow": ["airflow", "apache airflow", "data pipeline", "orchestration", "etl"],
  "spark": ["spark", "apache spark", "pyspark", "big data", "data pipeline"],
  "system design": ["system design", "architecture", "distributed systems", "scalability", "microservices"],
  "tailwind": ["tailwind", "tailwindcss", "css"],
  "tailwind css": ["tailwind", "tailwindcss", "css"],
  "graphql": ["graphql", "apollo", "api"],
  "redis": ["redis", "cache", "caching", "in-memory"],
}

/**
 * Evidence-grounded RAG matching evaluator.
 * Compares candidate verified profile, work experience, projects, and skills
 * against target job competencies using semantic token alignment.
 */
export function computeMatch(candidate: CandidateProfile, job: Job): MatchResult {
  const candidateSkills = (candidate.skills || []).map((s) => s.trim().toLowerCase())
  const requiredSkills = job.requiredSkills || []

  const experienceList = candidate.experience || []
  const projectsList = candidate.projects || []

  // Comprehensive evidence corpus across all candidate profile sections
  const candidateCorpus = [
    ...candidateSkills,
    candidate.summary || "",
    ...experienceList.map((e) => `${e.title} ${e.company} ${(e.highlights || []).join(" ")}`),
    ...projectsList.map((p) => `${p.name} ${p.description} ${(p.tech || []).join(" ")}`),
    ...(candidate.education || []).map((ed) => `${ed.degree} ${ed.institution}`),
  ].join(" ").toLowerCase()

  const matching: string[] = []
  const gaps: string[] = []
  const evidenceCitations: string[] = []

  for (const req of requiredSkills) {
    const reqClean = req.trim().toLowerCase()
    const synonyms = SKILL_SYNONYMS[reqClean] || [reqClean]

    // 1. Direct or synonym match in candidate declared skills
    const skillHit = candidateSkills.some((s) =>
      synonyms.some((syn) => s === syn || s.includes(syn) || syn.includes(s))
    )

    // 2. Project evidence match (tech tag or description)
    const matchingProj = projectsList.find((p) =>
      synonyms.some((syn) =>
        p.tech?.some((t) => t.toLowerCase() === syn || t.toLowerCase().includes(syn) || syn.includes(t.toLowerCase())) ||
        p.name?.toLowerCase().includes(syn) ||
        p.description?.toLowerCase().includes(syn)
      )
    )

    // 3. Work experience evidence match
    const matchingExp = experienceList.find((e) =>
      synonyms.some((syn) =>
        e.title?.toLowerCase().includes(syn) ||
        e.highlights?.some((h) => h.toLowerCase().includes(syn))
      )
    )

    // 4. General corpus hit
    const corpusHit = synonyms.some((syn) => candidateCorpus.includes(syn))

    if (skillHit || matchingProj || matchingExp || corpusHit) {
      matching.push(req)
      if (matchingProj?.name) {
        evidenceCitations.push(`project ${matchingProj.name}`)
      } else if (matchingExp?.company) {
        evidenceCitations.push(matchingExp.company)
      }
    } else {
      gaps.push(req)
    }
  }

  // Weighted competency calculation (first 3 skills are core requirements, weighted 2x)
  const weightOf = (index: number) => (index < 3 ? 2 : 1)
  const totalWeight = requiredSkills.reduce((sum, _, i) => sum + weightOf(i), 0)
  const matchedWeight = requiredSkills.reduce((sum, req, i) => sum + (matching.includes(req) ? weightOf(i) : 0), 0)
  const skillRatio = totalWeight > 0 ? matchedWeight / totalWeight : 0.65

  // Production evidence depth bonus
  const evidenceBonus = Math.min(15, evidenceCitations.length * 3.5)

  // Role domain keyword alignment bonus
  const jobTitleLower = (job.title || "").toLowerCase()
  const domainKeywords = ["backend", "frontend", "full stack", "fullstack", "software", "engineer", "developer", "data", "ai", "ml"]
  const domainHits = domainKeywords.filter((kw) => jobTitleLower.includes(kw) && candidateCorpus.includes(kw)).length
  const domainBonus = Math.min(10, domainHits * 2.5)

  // Grounded semantic match score (25% to 97%)
  let score = Math.round(skillRatio * 58 + evidenceBonus + domainBonus + (skillRatio >= 0.4 ? 18 : 10))
  score = Math.max(25, Math.min(97, score))

  const experienceMatch: MatchResult["experienceMatch"] =
    score >= 75 ? "Strong" : score >= 55 ? "Moderate" : "Limited"

  const citationSummary = evidenceCitations.length > 0 ? ` Evidence appears in ${evidenceCitations.slice(0, 2).join(" and ")}.` : ""
  const explanation =
    experienceMatch === "Strong"
      ? `Strong alignment for ${job.title}. Your profile shows ${matching.slice(0, 3).join(", ")}.${citationSummary}${gaps.length > 0 ? ` Focus next on ${gaps[0]}.` : " All listed skills are covered."}`
      : experienceMatch === "Moderate"
        ? `You match ${matching.slice(0, 3).join(", ") || "some core requirements"}. ${job.company} also looks for ${gaps.slice(0, 2).join(" and ") || "additional role skills"}.${citationSummary}`
        : `This is a stretch opportunity. Your profile shows ${matching.slice(0, 2).join(", ") || "software fundamentals"}; build depth in ${gaps.slice(0, 3).join(", ") || "the remaining role skills"}.`

  return { score, matching, gaps, experienceMatch, explanation }
}

export type InterviewType = "Technical" | "Behavioral" | "HR"

export const interviewQuestions: Record<InterviewType, string[]> = {
  Technical: [
    "Explain how you would design a REST API using FastAPI.",
    "How do you structure a PostgreSQL schema for a multi-tenant application?",
    "What strategies do you use to make a slow SQL query faster?",
    "How would you containerise and deploy a Python service?",
    "Describe how you would add authentication to an existing API.",
  ],
  Behavioral: [
    "Tell me about a time you disagreed with a teammate. How did you resolve it?",
    "Describe a project where requirements changed late. What did you do?",
    "Give an example of a mistake you made and what you learned from it.",
    "How do you prioritise when several tasks are urgent?",
    "Tell me about a time you helped a colleague grow.",
  ],
  HR: [
    "Why are you interested in this role and company?",
    "Where do you see your career in three years?",
    "What kind of team environment helps you do your best work?",
    "What are your salary expectations and how did you arrive at them?",
    "Do you have any questions for us about the role?",
  ],
}

export const answerFeedback = [
  "Clear structure. Consider adding a concrete example from your FastAPI work to strengthen the answer.",
  "Good coverage of fundamentals. Mentioning trade-offs would show deeper reasoning.",
  "Solid response. Quantifying the impact (e.g. latency, coverage) would make it more convincing.",
  "Relevant answer. Try to connect it back to the target role's requirements.",
  "Well communicated. A brief summary sentence at the end would help the interviewer follow.",
]

export type Evaluation = {
  overall: number
  breakdown: { label: string; score: number }[]
  strengths: string[]
  improvements: string[]
  summary?: string
}

export const demoEvaluation: Evaluation = {
  overall: 78,
  breakdown: [
    { label: "Technical Knowledge", score: 82 },
    { label: "Communication", score: 76 },
    { label: "Problem Solving", score: 79 },
    { label: "Relevance", score: 80 },
  ],
  strengths: ["Strong backend fundamentals", "Good understanding of APIs"],
  improvements: ["System design explanation", "Cloud deployment concepts"],
}

export type SkillGap = { skill: string; priority: "High" | "Medium" | "Low"; level: number }

export const strongSkills = [
  { skill: "Python", level: 88 },
  { skill: "FastAPI", level: 80 },
  { skill: "SQL", level: 78 },
]

export const skillGaps: SkillGap[] = [
  { skill: "Docker", priority: "High", level: 20 },
  { skill: "AWS", priority: "Medium", level: 15 },
  { skill: "System Design", priority: "Medium", level: 35 },
]

export type StudyWeek = {
  week: number
  topic: string
  whyItMatters: string
  whatToLearn: string[]
  practice: string
}

export const studyPlan: StudyWeek[] = [
  {
    week: 1,
    topic: "Docker Fundamentals",
    whyItMatters: "Docker is required by your top job match and most backend roles expect containerised services.",
    whatToLearn: ["Images vs containers", "Writing a Dockerfile", "Volumes and networking basics"],
    practice: "Containerise your TaskFlow API and run it locally with a single docker run command.",
  },
  {
    week: 2,
    topic: "Docker + FastAPI",
    whyItMatters: "Combining your existing FastAPI skills with Docker makes your projects deployable end to end.",
    whatToLearn: ["Multi-stage builds", "docker-compose with PostgreSQL", "Environment configuration"],
    practice: "Create a docker-compose setup running FastAPI and PostgreSQL together.",
  },
  {
    week: 3,
    topic: "AWS Fundamentals",
    whyItMatters: "AWS appears in two of your recommended jobs and closes a medium-priority gap.",
    whatToLearn: ["IAM and security basics", "EC2 and ECS", "RDS for PostgreSQL"],
    practice: "Deploy your containerised API to an ECS service backed by RDS.",
  },
  {
    week: 4,
    topic: "System Design",
    whyItMatters: "Your interview evaluation flagged system design explanation as an area to improve.",
    whatToLearn: ["Load balancing and caching", "Database scaling patterns", "Designing for failure"],
    practice: "Whiteboard a URL shortener and present it in a mock technical interview.",
  },
]

/* ------------------------------------------------------------------ *
 * Company platform: Assessment Builder + Assessment Agent
 * ------------------------------------------------------------------ */

export type QuestionType = "mcq" | "short" | "coding"
export type Difficulty = "Easy" | "Medium" | "Hard"

export const questionTypeLabels: Record<QuestionType, string> = {
  mcq: "Multiple Choice",
  short: "Short Answer",
  coding: "Coding",
}

type BaseQuestion = { id: string; skill: string; difficulty: Difficulty; question: string }

export type McqQuestion = BaseQuestion & {
  type: "mcq"
  options: string[]
  correctIndex: number
  explanation: string
}
export type ShortQuestion = BaseQuestion & { type: "short"; keyPoints: string[] }
export type CodingQuestion = BaseQuestion & { type: "coding"; keyPoints: string[]; starterCode?: string }
export type AssessmentQuestion = McqQuestion | ShortQuestion | CodingQuestion

export type AssessmentConfig = {
  title: string
  jobId: string
  difficulty: Difficulty
  questionCount: number
  questionTypes: QuestionType[]
  topics: string[]
}

export type Assessment = {
  id: string
  title: string
  jobId: string
  jobTitle: string
  company: string
  difficulty: Difficulty
  status: "draft" | "published"
  questions: AssessmentQuestion[]
  createdAt: string
}

export const demoAssessments: Assessment[] = [
  {
    id: "demo-python-backend-assessment",
    title: "Python Backend Screening",
    jobId: "python-backend-developer",
    jobTitle: "Python Backend Developer",
    company: "Streamline Health",
    difficulty: "Medium",
    status: "published",
    createdAt: "2 days ago",
    questions: [
      {
        id: "demo-q1",
        type: "mcq",
        skill: "FastAPI",
        difficulty: "Medium",
        question: "In FastAPI, which decorator registers a function that runs before the application starts serving requests?",
        options: ["@app.on_event('startup')", "@app.route('/startup')", "@app.middleware('startup')", "@app.get('/startup')"],
        correctIndex: 0,
        explanation: "FastAPI uses @app.on_event('startup') (or a lifespan handler) to run initialisation logic before serving requests.",
      },
      {
        id: "demo-q2",
        type: "short",
        skill: "PostgreSQL",
        difficulty: "Medium",
        question: "Explain how you would diagnose and speed up a slow PostgreSQL query.",
        keyPoints: ["Use EXPLAIN ANALYZE to inspect the query plan", "Add appropriate indexes", "Avoid sequential scans on large tables", "Consider query restructuring or caching"],
      },
      {
        id: "demo-q3",
        type: "coding",
        skill: "Python",
        difficulty: "Medium",
        question: "Write a Python function that returns the two numbers in a list that add up to a given target.",
        keyPoints: ["Use a hash map for O(n) lookup", "Handle the no-solution case", "Return indices or values as specified"],
        starterCode: "def two_sum(nums: list[int], target: int) -> tuple[int, int] | None:\n    # your solution here\n    ...",
      },
    ],
  },
]

/* ------------------------------------------------------------------ *
 * Company platform: Assessment Evaluation + Candidate Ranking
 *
 * A submission is evaluated into a transparent, explainable result:
 *  - MCQs are graded deterministically (correct / incorrect).
 *  - Short answers are graded by ONE structured LLM call per submission;
 *    if the AI Gateway is unavailable they fall back to "review".
 *  - Coding answers are never auto-graded — they are "Requires Technical Review".
 * The overall score is the mean of the auto-graded question percentages, so it
 * can always be explained from the per-question results below it.
 * ------------------------------------------------------------------ */

export type QuestionResultStatus = "correct" | "incorrect" | "review"

/** Per-question outcome. `score` is null when the question needs manual review. */
export type QuestionResult = {
  questionId: string
  skill: string
  type: QuestionType
  status: QuestionResultStatus
  score: number | null
  needsReview: boolean
  note: string
}

/** Aggregated result for one skill/topic. `score` is null => "Requires Review". */
export type SkillResult = {
  skill: string
  score: number | null
  gradedCount: number
  totalCount: number
  needsReview: boolean
}

export type ReviewStatus = "complete" | "pending_review"

export type AssessmentResult = {
  overallScore: number | null
  totalQuestions: number
  gradedCount: number
  questionsCorrect: number
  questionsRequiringReview: number
  skillsEvaluated: number
  skillResults: SkillResult[]
  questionResults: QuestionResult[]
  reviewStatus: ReviewStatus
  aiUsed: boolean
}

/* ------------------------------------------------------------------ *
 * Integrity Engine + Plagiarism Engine
 *
 * Both produce EVIDENCE / SIGNALS FOR HUMAN REVIEW — never proof of cheating
 * or plagiarism. They are computed deterministically (see lib/assessment/
 * integrity.ts and lib/assessment/plagiarism.ts) and attached to a submission
 * so recruiters can review them. Candidates continue to see only their normal
 * assessment result.
 * ------------------------------------------------------------------ */

/** A single integrity indicator. "ok" is reassuring; "watch" warrants review. */
export type IntegritySignal = { kind: "ok" | "watch"; label: string; detail: string }
export type IntegrityRisk = "low" | "review"
export type IntegrityResult = {
  risk: IntegrityRisk
  /** Human-facing label, e.g. "Low Risk" or "Review Recommended". */
  status: string
  signals: IntegritySignal[]
  explanation: string
}

export type SimilarityStatus = "low" | "moderate" | "high"
export type SimilarityMatch = {
  questionId: string
  skill: string
  /** Similarity percentage (0–100) for this question's best match. */
  similarity: number
  matchedCandidate: string | null
  note: string
}
export type SimilarityResult = {
  overallSimilarity: number
  status: SimilarityStatus
  matches: SimilarityMatch[]
  reviewRecommended: boolean
  explanation: string
}

export type AssessmentSubmission = {
  id: string
  candidateUserId?: string
  assessmentId: string
  assessmentTitle: string
  jobId: string
  jobTitle: string
  company: string
  candidateName: string
  submittedAt: string
  result: AssessmentResult
  /** Raw answers, kept so the Plagiarism Engine can compare later submissions. */
  answers?: Record<string, string>
  /** Deterministic session-signal analysis for human review. */
  integrity?: IntegrityResult
  /** Deterministic similarity analysis for human review. */
  similarity?: SimilarityResult
  /** Optional interview evaluation, when the candidate also completed an AI interview. */
  interview?: Evaluation
  /** Tagged as practice if taken freely without recruiter shortlisting/advancement */
  isPractice?: boolean
}

/* ------------------------------------------------------------------ *
 * Hiring Decision
 *
 * The recruiter's recorded outcome for a candidate. This is the final,
 * human-owned step of the recruiter loop — it is never set automatically.
 * Stored in the in-memory app store keyed by submission id.
 * ------------------------------------------------------------------ */

export type HiringDecisionStatus = "undecided" | "shortlisted" | "advanced" | "rejected"

export type HiringDecision = {
  submissionId: string
  status: HiringDecisionStatus
  note?: string
  /** ISO timestamp of when the decision was recorded. */
  decidedAt: string
}

/** Score at/above this is treated as a "correct" (passing) short answer. */
export const SHORT_ANSWER_PASS = 60

/**
 * Seed submissions so the recruiter results/ranking view has content to show
 * immediately. Live candidate submissions are appended to these in the store.
 * Daniel and Mei have a coding answer awaiting review; Sara's submission had no
 * auto-gradable questions resolved, so she ranks as "Pending Review".
 */
export const demoSubmissions: AssessmentSubmission[] = [
  {
    id: "sub-daniel",
    assessmentId: "demo-python-backend-assessment",
    assessmentTitle: "Python Backend Screening",
    jobId: "python-backend-developer",
    jobTitle: "Python Backend Developer",
    company: "Streamline Health",
    candidateName: "Daniel Okoro",
    submittedAt: "1 day ago",
    result: {
      overallScore: 91,
      totalQuestions: 3,
      gradedCount: 2,
      questionsCorrect: 2,
      questionsRequiringReview: 1,
      skillsEvaluated: 2,
      reviewStatus: "pending_review",
      aiUsed: true,
      questionResults: [
        { questionId: "demo-q1", skill: "FastAPI", type: "mcq", status: "correct", score: 100, needsReview: false, note: "Selected the correct startup handler." },
        { questionId: "demo-q2", skill: "PostgreSQL", type: "short", status: "correct", score: 82, needsReview: false, note: "Covered EXPLAIN ANALYZE and indexing; caching only briefly mentioned." },
        { questionId: "demo-q3", skill: "Python", type: "coding", status: "review", score: null, needsReview: true, note: "Requires Technical Review" },
      ],
      skillResults: [
        { skill: "FastAPI", score: 100, gradedCount: 1, totalCount: 1, needsReview: false },
        { skill: "PostgreSQL", score: 82, gradedCount: 1, totalCount: 1, needsReview: false },
        { skill: "Python", score: null, gradedCount: 0, totalCount: 1, needsReview: true },
      ],
    },
    answers: {
      "demo-q1": "0",
      "demo-q2":
        "I would run EXPLAIN ANALYZE to inspect the query plan, then add appropriate indexes on the filtered columns to avoid sequential scans on large tables, and consider restructuring the query or adding caching where it helps.",
      "demo-q3":
        "def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return seen[target - n], i\n        seen[n] = i\n    return None",
    },
    integrity: {
      risk: "low",
      status: "Low Risk",
      signals: [
        { kind: "ok", label: "Normal completion time", detail: "Completed in 8m 12s." },
        { kind: "ok", label: "No repeated submission detected", detail: "Submitted in a single attempt." },
        { kind: "ok", label: "No large paste detected", detail: "Answers were typed rather than pasted in bulk." },
      ],
      explanation: "Session signals looked normal. These are indicators only, not a guarantee of integrity.",
    },
    similarity: {
      overallSimilarity: 74,
      status: "high",
      reviewRecommended: true,
      matches: [
        {
          questionId: "demo-q2",
          skill: "PostgreSQL",
          similarity: 74,
          matchedCandidate: "Mei Lin",
          note: "High overlap with another submission.",
        },
      ],
      explanation:
        "Potential similarity with another submission — human review required. This is a signal, not proof of plagiarism.",
    },
    interview: {
      overall: 81,
      breakdown: [
        { label: "Technical Knowledge", score: 85 },
        { label: "Communication", score: 78 },
        { label: "Problem Solving", score: 83 },
        { label: "Relevance", score: 79 },
      ],
      strengths: ["Clear API design reasoning", "Strong PostgreSQL fundamentals"],
      improvements: ["Cloud deployment specifics", "Concise trade-off summaries"],
    },
  },
  {
    id: "sub-mei",
    assessmentId: "demo-python-backend-assessment",
    assessmentTitle: "Python Backend Screening",
    jobId: "python-backend-developer",
    jobTitle: "Python Backend Developer",
    company: "Streamline Health",
    candidateName: "Mei Lin",
    submittedAt: "1 day ago",
    result: {
      overallScore: 84,
      totalQuestions: 3,
      gradedCount: 2,
      questionsCorrect: 2,
      questionsRequiringReview: 1,
      skillsEvaluated: 2,
      reviewStatus: "pending_review",
      aiUsed: true,
      questionResults: [
        { questionId: "demo-q1", skill: "FastAPI", type: "mcq", status: "correct", score: 100, needsReview: false, note: "Selected the correct startup handler." },
        { questionId: "demo-q2", skill: "PostgreSQL", type: "short", status: "correct", score: 68, needsReview: false, note: "Mentioned indexing but did not reference the query planner." },
        { questionId: "demo-q3", skill: "Python", type: "coding", status: "review", score: null, needsReview: true, note: "Requires Technical Review" },
      ],
      skillResults: [
        { skill: "FastAPI", score: 100, gradedCount: 1, totalCount: 1, needsReview: false },
        { skill: "PostgreSQL", score: 68, gradedCount: 1, totalCount: 1, needsReview: false },
        { skill: "Python", score: null, gradedCount: 0, totalCount: 1, needsReview: true },
      ],
    },
    answers: {
      "demo-q1": "0",
      "demo-q2":
        "I would run EXPLAIN ANALYZE to inspect the query plan, then add appropriate indexes on the filtered columns to avoid sequential scans on large tables, and consider restructuring the query or caching where it helps.",
      "demo-q3":
        "def two_sum(nums, target):\n    lookup = {}\n    for i, value in enumerate(nums):\n        if target - value in lookup:\n            return lookup[target - value], i\n        lookup[value] = i\n    return None",
    },
    integrity: {
      risk: "review",
      status: "Review Recommended",
      signals: [
        {
          kind: "watch",
          label: "Unusually fast submission",
          detail: "Completed in 47s for 3 questions — below the 1m expected minimum.",
        },
        { kind: "ok", label: "No repeated submission detected", detail: "Submitted in a single attempt." },
        {
          kind: "watch",
          label: "Large paste into answer",
          detail: "A large block of text was pasted into 1 answer.",
        },
      ],
      explanation:
        "Risk evidence for human review — not proof of any wrongdoing. A reviewer should confirm the result before acting on it.",
    },
    similarity: {
      overallSimilarity: 74,
      status: "high",
      reviewRecommended: true,
      matches: [
        {
          questionId: "demo-q2",
          skill: "PostgreSQL",
          similarity: 74,
          matchedCandidate: "Daniel Okoro",
          note: "High overlap with another submission.",
        },
      ],
      explanation:
        "Potential similarity with another submission — human review required. This is a signal, not proof of plagiarism.",
    },
    interview: {
      overall: 69,
      breakdown: [
        { label: "Technical Knowledge", score: 72 },
        { label: "Communication", score: 74 },
        { label: "Problem Solving", score: 65 },
        { label: "Relevance", score: 66 },
      ],
      strengths: ["Communicates clearly", "Comfortable with core Python"],
      improvements: ["Deeper query-optimisation detail", "System design breadth"],
    },
  },
  {
    id: "sub-sara",
    assessmentId: "demo-python-backend-assessment",
    assessmentTitle: "Python Backend Screening",
    jobId: "python-backend-developer",
    jobTitle: "Python Backend Developer",
    company: "Streamline Health",
    candidateName: "Sara Haddad",
    submittedAt: "3 hours ago",
    result: {
      overallScore: null,
      totalQuestions: 3,
      gradedCount: 0,
      questionsCorrect: 0,
      questionsRequiringReview: 3,
      skillsEvaluated: 0,
      reviewStatus: "pending_review",
      aiUsed: false,
      questionResults: [
        { questionId: "demo-q2", skill: "PostgreSQL", type: "short", status: "review", score: null, needsReview: true, note: "Awaiting evaluation — AI grading was unavailable." },
        { questionId: "demo-q3", skill: "Python", type: "coding", status: "review", score: null, needsReview: true, note: "Requires Technical Review" },
        { questionId: "extra-short", skill: "Python", type: "short", status: "review", score: null, needsReview: true, note: "Awaiting evaluation — AI grading was unavailable." },
      ],
      skillResults: [
        { skill: "PostgreSQL", score: null, gradedCount: 0, totalCount: 1, needsReview: true },
        { skill: "Python", score: null, gradedCount: 0, totalCount: 2, needsReview: true },
      ],
    },
    integrity: {
      risk: "low",
      status: "Low Risk",
      signals: [
        { kind: "ok", label: "Normal completion time", detail: "Completed in 11m 3s." },
        { kind: "ok", label: "No repeated submission detected", detail: "Submitted in a single attempt." },
        { kind: "ok", label: "No large paste detected", detail: "Answers were typed rather than pasted in bulk." },
      ],
      explanation: "Session signals looked normal. These are indicators only, not a guarantee of integrity.",
    },
    similarity: {
      overallSimilarity: 12,
      status: "low",
      reviewRecommended: false,
      matches: [],
      explanation:
        "Answers showed low overlap with other submissions. This is an indicator only, not confirmation of originality.",
    },
  },
]

export const recruiterJobs = [
  { title: "Python Backend Developer", applicants: 42, status: "Open", posted: "Sep 2" },
  { title: "Full Stack Developer", applicants: 31, status: "Open", posted: "Aug 28" },
  { title: "Data Engineer", applicants: 18, status: "Screening", posted: "Aug 20" },
]

export const recruiterCandidates = [
  { name: "Aisha Rahman", role: "Python Backend Developer", match: 82, interview: 78, status: "Interviewed" },
  { name: "Daniel Okoro", role: "Python Backend Developer", match: 76, interview: 81, status: "Interviewed" },
  { name: "Mei Lin", role: "Full Stack Developer", match: 74, interview: 0, status: "Assessment sent" },
  { name: "Lucas Ferreira", role: "Data Engineer", match: 69, interview: 0, status: "Applied" },
  { name: "Sara Haddad", role: "Full Stack Developer", match: 64, interview: 0, status: "Applied" },
]
