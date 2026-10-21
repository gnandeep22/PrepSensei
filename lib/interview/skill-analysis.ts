import type { CandidateProfile, Evaluation, Job, StudyWeek } from "@/lib/demo-data"

/**
 * Deterministic bridge: Interview Evaluation -> Skill Gap -> Study Plan.
 *
 *   evaluation (+ target job + candidate profile) -> analyzeSkills() -> buildStudyPlan()
 *
 * This is pure and synchronous. It reuses the structured `Evaluation` the
 * Interview Agent already returns (whether from the LLM or the deterministic
 * fallback) and makes NO additional AI calls, so the Skill Gap and Study Plan
 * pages always receive valid data even when the AI Gateway is unavailable.
 */

export type SkillStatus = "strong" | "improve" | "missing"
export type Priority = "High" | "Medium" | "Low"

export type DerivedSkill = {
  skill: string
  /** 0–100 proficiency estimate used to size the progress bar. */
  level: number
  status: SkillStatus
  priority: Priority
}

export type SkillAnalysis = {
  /** Required skills the candidate demonstrated well. */
  strong: DerivedSkill[]
  /** Weak / missing required skills plus interview-flagged improvement areas. */
  gaps: DerivedSkill[]
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)))

type SkillKnowledge = {
  skill: string
  /** Lower-cased substrings that map a free-text improvement phrase to this skill. */
  keywords: string[]
  topic: string
  whyItMatters: string
  whatToLearn: string[]
  practice: string
}

/**
 * Curated study content for the skills that appear across the demo jobs. Order
 * matters: multi-word / more specific keywords are listed before generic ones
 * so "system design" resolves before a bare "design".
 */
const SKILL_KB: SkillKnowledge[] = [
  {
    skill: "System Design",
    keywords: ["system design", "architecture", "scalab", "design explanation", "high level design", "trade-off", "tradeoff"],
    topic: "System Design",
    whyItMatters: "Your interview evaluation flagged system design explanation as an area to improve; senior backend roles expect it.",
    whatToLearn: ["Load balancing and caching", "Database scaling patterns", "Designing for failure and bottlenecks"],
    practice: "Whiteboard a URL shortener end to end and present it in a mock technical interview.",
  },
  {
    skill: "AWS",
    keywords: ["aws", "cloud", "deployment", "deploy", "hosting", "infrastructure"],
    topic: "AWS Fundamentals",
    whyItMatters: "Cloud deployment came up as a weak area and AWS is required by your target role.",
    whatToLearn: ["IAM and security basics", "EC2 and ECS", "RDS for PostgreSQL"],
    practice: "Deploy a containerised API to an ECS service backed by RDS.",
  },
  {
    skill: "Docker",
    keywords: ["docker", "container", "containeris", "containeriz"],
    topic: "Docker Fundamentals",
    whyItMatters: "Docker is required by your target job and most backend roles expect containerised services.",
    whatToLearn: ["Images vs containers", "Writing a Dockerfile", "docker-compose with PostgreSQL"],
    practice: "Containerise one of your APIs and run it locally with a single docker run command.",
  },
  {
    skill: "PostgreSQL",
    keywords: ["postgres", "postgresql", "indexing", "query optimis", "query optimiz", "schema design"],
    topic: "PostgreSQL In Depth",
    whyItMatters: "PostgreSQL is a core requirement and your answers here can be strengthened with concrete depth.",
    whatToLearn: ["SQL fundamentals and joins", "Writing and reading query plans", "Indexing strategies (B-tree, partial, composite)"],
    practice: "Take a slow query, run EXPLAIN ANALYZE, add an index, and measure the improvement.",
  },
  {
    skill: "SQL",
    keywords: ["sql "],
    topic: "SQL Fundamentals",
    whyItMatters: "Strong SQL underpins most backend and data roles you are targeting.",
    whatToLearn: ["Joins and aggregation", "Subqueries and CTEs", "Window functions"],
    practice: "Solve a set of intermediate SQL exercises and explain each query plan.",
  },
  {
    skill: "FastAPI",
    keywords: ["fastapi"],
    topic: "FastAPI Depth",
    whyItMatters: "FastAPI is central to your target role; deeper knowledge makes your answers more convincing.",
    whatToLearn: ["Dependency injection", "Pydantic models and validation", "Background tasks and lifespan events"],
    practice: "Add dependency-injected auth and request validation to an existing FastAPI service.",
  },
  {
    skill: "REST APIs",
    keywords: ["rest", "api design", "endpoint"],
    topic: "REST API Design",
    whyItMatters: "Clear API design is a recurring requirement across your target roles.",
    whatToLearn: ["Resource modelling and status codes", "Pagination, filtering, versioning", "Error handling conventions"],
    practice: "Design and document a small REST API, including its error responses.",
  },
  {
    skill: "Python",
    keywords: ["python"],
    topic: "Python Proficiency",
    whyItMatters: "Python is the foundation of your target roles; polishing fundamentals sharpens every answer.",
    whatToLearn: ["Idiomatic data structures", "Type hints and generics", "Async and concurrency basics"],
    practice: "Refactor a script to be fully type-hinted and add unit tests.",
  },
  {
    skill: "Testing",
    keywords: ["test", "coverage", "unit test", "integration test"],
    topic: "Testing Practices",
    whyItMatters: "Reliable teams expect strong testing habits, which came up as an area to reinforce.",
    whatToLearn: ["Unit vs integration tests", "Fixtures and mocking", "Measuring meaningful coverage"],
    practice: "Raise test coverage on a project module and add integration tests for its API.",
  },
  {
    skill: "React",
    keywords: ["react", "frontend", "component"],
    topic: "React Fundamentals",
    whyItMatters: "React is required by full-stack roles you are targeting.",
    whatToLearn: ["Component state and props", "Hooks and effects", "Data fetching patterns"],
    practice: "Build a small React feature that fetches and renders data with loading and error states.",
  },
  {
    skill: "TypeScript",
    keywords: ["typescript"],
    topic: "TypeScript Essentials",
    whyItMatters: "TypeScript appears in full-stack roles and improves the quality of your frontend answers.",
    whatToLearn: ["Types vs interfaces", "Generics and utility types", "Narrowing and discriminated unions"],
    practice: "Add strict types to an untyped JavaScript module.",
  },
  {
    skill: "Machine Learning",
    keywords: ["machine learning", "ml ", "model training", "recommendation"],
    topic: "Machine Learning Foundations",
    whyItMatters: "ML fundamentals are required for the AI/ML roles you are targeting.",
    whatToLearn: ["Train/validation/test splits", "Bias–variance trade-off", "Common evaluation metrics"],
    practice: "Train and evaluate a simple classifier and explain its metrics.",
  },
  {
    skill: "PyTorch",
    keywords: ["pytorch"],
    topic: "PyTorch Basics",
    whyItMatters: "PyTorch is required by the AI/ML engineer role.",
    whatToLearn: ["Tensors and autograd", "Building a training loop", "Datasets and DataLoaders"],
    practice: "Implement and train a small neural network in PyTorch.",
  },
  {
    skill: "MLOps",
    keywords: ["mlops", "model deployment", "serving"],
    topic: "MLOps Fundamentals",
    whyItMatters: "MLOps closes the gap between models and production for AI roles.",
    whatToLearn: ["Model packaging and serving", "Experiment tracking", "Monitoring and retraining"],
    practice: "Serve a trained model behind an API and log its predictions.",
  },
  {
    skill: "Airflow",
    keywords: ["airflow", "orchestrat", "pipeline"],
    topic: "Workflow Orchestration",
    whyItMatters: "Airflow is required for the data engineering role you are targeting.",
    whatToLearn: ["DAGs and operators", "Scheduling and backfills", "Task dependencies and retries"],
    practice: "Build an Airflow DAG that runs a small multi-step data pipeline.",
  },
  {
    skill: "Spark",
    keywords: ["spark"],
    topic: "Distributed Data with Spark",
    whyItMatters: "Spark is required for large-scale data processing in the data engineer role.",
    whatToLearn: ["RDDs vs DataFrames", "Transformations and actions", "Partitioning and shuffles"],
    practice: "Process a dataset with Spark DataFrames and explain the execution plan.",
  },
  {
    skill: "Git",
    keywords: ["git", "version control", "branching"],
    topic: "Git Workflows",
    whyItMatters: "Confident version control is expected on every engineering team.",
    whatToLearn: ["Branching strategies", "Rebase vs merge", "Resolving conflicts"],
    practice: "Practice an interactive rebase and a conflict resolution on a sample repo.",
  },
]

/** Resolve a free-text improvement phrase to a known skill, if possible. */
function matchTopic(phrase: string): SkillKnowledge | null {
  const hay = ` ${phrase.toLowerCase()} `
  for (const kb of SKILL_KB) {
    if (kb.keywords.some((k) => hay.includes(k))) return kb
  }
  return null
}

/** Title-case a fallback label so unmapped improvement phrases still read cleanly. */
function cleanLabel(phrase: string): string {
  return phrase
    .replace(/[.]+$/, "")
    .split(/\s+/)
    .slice(0, 4)
    .join(" ")
    .replace(/^\w/, (c) => c.toUpperCase())
}

/**
 * Derive strong skills and prioritised gaps from the interview evaluation,
 * compared against the target job's required skills and the candidate profile.
 */
export function analyzeSkills(evaluation: Evaluation, job: Job, profile: CandidateProfile): SkillAnalysis {
  const candidateSkills = new Set(profile.skills.map((s) => s.toLowerCase()))
  const technical = evaluation.breakdown.find((b) => /technical/i.test(b.label))?.score ?? evaluation.overall
  const overall = evaluation.overall

  const strong = new Map<string, DerivedSkill>()
  const gaps = new Map<string, DerivedSkill>()

  // 1. Compare each required skill against the candidate's profile.
  job.requiredSkills.forEach((skill, index) => {
    const isCore = index < 3 // mirrors computeMatch(): first three requirements are core.
    const key = skill.toLowerCase()
    if (candidateSkills.has(key)) {
      strong.set(key, { skill, level: clamp(technical - (isCore ? 0 : 3), 55, 96), status: "strong", priority: "Low" })
    } else {
      gaps.set(key, {
        skill,
        level: clamp((overall / 100) * 22 + (isCore ? 0 : 6), 10, 42),
        status: "missing",
        priority: isCore ? "High" : "Medium",
      })
    }
  })

  // 2. Fold the interview's improvement areas in, raising priority. A skill the
  //    candidate has but was flagged becomes "needs improvement"; anything new
  //    becomes a high-priority gap.
  for (const phrase of evaluation.improvements) {
    const kb = matchTopic(phrase)
    const skill = kb?.skill ?? cleanLabel(phrase)
    const key = skill.toLowerCase()
    const has = candidateSkills.has(key)

    strong.delete(key)
    const existing = gaps.get(key)
    if (existing) {
      existing.priority = "High"
      existing.status = has ? "improve" : "missing"
    } else {
      gaps.set(key, {
        skill,
        level: has ? clamp(technical - 22, 30, 62) : 30,
        status: has ? "improve" : "missing",
        priority: "High",
      })
    }
  }

  const priorityRank: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 }
  return {
    strong: [...strong.values()].sort((a, b) => b.level - a.level),
    gaps: [...gaps.values()].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.level - b.level),
  }
}

function genericWeek(week: number, skill: string): StudyWeek {
  return {
    week,
    topic: skill,
    whyItMatters: `Your interview evaluation flagged ${skill} as an area to strengthen for your target role.`,
    whatToLearn: [`Core concepts of ${skill}`, `Common interview questions on ${skill}`, `Hands-on fundamentals`],
    practice: `Complete a small hands-on exercise focused on ${skill} and explain your approach out loud.`,
  }
}

/**
 * Build a study plan (up to four weeks) from the derived gaps, highest priority
 * first, reusing the existing `StudyWeek` shape the Study Plan page renders.
 */
export function buildStudyPlan(analysis: SkillAnalysis): StudyWeek[] {
  const focus = analysis.gaps.slice(0, 4)
  if (focus.length === 0) {
    return [
      {
        week: 1,
        topic: "Interview Consolidation",
        whyItMatters: "Your interview showed no major gaps against this role — consolidate your strengths and polish delivery.",
        whatToLearn: ["Structuring answers with the STAR method", "Quantifying impact in examples", "Concise technical explanations"],
        practice: "Record yourself answering three questions and refine each answer for clarity.",
      },
    ]
  }
  return focus.map((g, i) => {
    const kb = SKILL_KB.find((k) => k.skill.toLowerCase() === g.skill.toLowerCase())
    if (!kb) return genericWeek(i + 1, g.skill)
    return { week: i + 1, topic: kb.topic, whyItMatters: kb.whyItMatters, whatToLearn: kb.whatToLearn, practice: kb.practice }
  })
}
