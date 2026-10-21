/**
 * Small local interview knowledge base for the RAG pipeline.
 *
 * This is intentionally tiny and in-memory. Each document is chunked and
 * embedded once at runtime (see lib/rag/retriever.ts). The structure is kept
 * generic so it can later be swapped for PostgreSQL + pgvector without
 * changing the retriever's public API.
 */

export type KbCategory = "technical" | "behavioral" | "hr"

export type KbDocument = {
  id: string
  topic: string
  category: KbCategory
  text: string
}

export const knowledgeBase: KbDocument[] = [
  {
    id: "python",
    topic: "Python",
    category: "technical",
    text: "Python is a dynamically typed language often used for backend services. Interviewers probe understanding of data structures like lists, dicts and sets, and their time complexity. Strong answers mention generators for memory efficiency, context managers for resource cleanup, and virtual environments for dependency isolation. Discussing the GIL and when to use asyncio versus threads versus multiprocessing signals depth.",
  },
  {
    id: "fastapi",
    topic: "FastAPI",
    category: "technical",
    text: "FastAPI is an async Python web framework built on Starlette and Pydantic. Good candidates explain how path operations, dependency injection and Pydantic models provide validation and automatic OpenAPI docs. They describe using async def handlers for IO-bound work and background tasks for deferred work. Structuring an app into routers, services and repositories keeps it testable and maintainable.",
  },
  {
    id: "rest-apis",
    topic: "REST APIs",
    category: "technical",
    text: "A well designed REST API uses nouns for resources, correct HTTP verbs, and meaningful status codes such as 200, 201, 400, 401, 404 and 500. Interviewers look for pagination, filtering, versioning and idempotency of PUT and DELETE. Strong answers cover authentication with tokens, rate limiting, consistent error envelopes and documenting the contract with OpenAPI.",
  },
  {
    id: "postgresql",
    topic: "PostgreSQL",
    category: "technical",
    text: "PostgreSQL questions focus on schema design, normalisation and indexing. Candidates should explain B-tree indexes, when a composite index helps, and reading EXPLAIN ANALYZE to find slow scans. Multi-tenant designs can use a tenant_id column with row level security or separate schemas. Transactions, isolation levels and avoiding N+1 queries are common follow-ups.",
  },
  {
    id: "system-design",
    topic: "Backend System Design",
    category: "technical",
    text: "Backend system design interviews start from requirements and scale estimates. Candidates discuss stateless services behind a load balancer, caching with Redis, and database read replicas for scaling reads. Asynchronous work is offloaded to queues. Strong answers address failure handling with retries, timeouts and idempotency, plus observability through metrics, logs and tracing.",
  },
  {
    id: "docker-deploy",
    topic: "Containers and Deployment",
    category: "technical",
    text: "Containerising a Python service uses a Dockerfile with a slim base image, a dependency layer for caching, and a non-root user. Multi-stage builds keep images small. Configuration comes from environment variables, never hard-coded secrets. Deployments favour health checks, rolling updates and running database migrations as a separate controlled step.",
  },
  {
    id: "behavioral-star",
    topic: "Behavioral Interviews",
    category: "behavioral",
    text: "Behavioral interviews are best answered with the STAR method: Situation, Task, Action, Result. Interviewers want a specific real story rather than generalities, with a clear personal contribution and a measurable outcome. Reflecting on what you learned strengthens the answer. Common themes are conflict, ownership, dealing with ambiguity and recovering from failure.",
  },
  {
    id: "behavioral-teamwork",
    topic: "Teamwork and Conflict",
    category: "behavioral",
    text: "For teamwork and conflict questions, describe how you listened to understand the other view, focused on shared goals, and used data rather than opinion to reach agreement. Show empathy and a bias toward resolving disagreement constructively. Mention how the outcome improved the product or the relationship, and what you would repeat next time.",
  },
  {
    id: "hr-motivation",
    topic: "HR and Motivation",
    category: "hr",
    text: "HR questions cover motivation, fit and expectations. Explain why the specific role and company appeal to you with concrete reasons tied to their work. Career goal answers should connect near-term growth to the role. When asked about salary, give a researched range and justify it with market data and your experience, staying flexible and professional.",
  },
  {
    id: "hr-closing",
    topic: "HR Closing Questions",
    category: "hr",
    text: "Toward the end, HR often asks about your questions for them and about work environment. Prepared candidates ask about team structure, how success is measured, and growth opportunities. Describing an ideal environment honestly, such as collaborative teams with clear ownership, signals self-awareness and helps assess mutual fit.",
  },
]
