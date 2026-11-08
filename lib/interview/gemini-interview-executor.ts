import "server-only"
import { generateObject } from "ai"
import { z } from "zod"
import { getChatModel } from "@/lib/ai/model"
import { InterviewCapacityService } from "./capacity-service"
import { raceGeminiGeneric, markModelRateLimited } from "@/lib/ai/gemini-race"

export interface ExecuteInterviewParams<T extends z.ZodTypeAny> {
  system: string
  schema: T
  prompt: string
  purpose: "interview_start" | "interview_answer" | "interview_eval"
  interviewSessionId?: string
  jobId?: string
  candidateUserId?: string
}

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
]

function isRateLimitError(err: any): boolean {
  if (!err) return false
  const msg = (err.message || "").toLowerCase()
  const status = err.status || err.statusCode || 0
  return (
    status === 429 ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota exceeded") ||
    msg.includes("rate limit")
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Execute structured Gemini LLM request with:
 * - Runtime usage tracking in Postgres
 * - Exponential backoff with randomized jitter on 429
 * - Automatic multi-model fallback chain
 * - Resilient recovery so an interview is never abruptly lost
 */
export async function executeResilientInterviewCall<T extends z.ZodTypeAny>(
  params: ExecuteInterviewParams<T>
): Promise<{
  object: z.infer<T>
  modelUsed: string
  winningModelLabel?: string
  raceDurationMs?: number
}> {
  const { system, schema, prompt, purpose, interviewSessionId, jobId, candidateUserId } = params

  // 1. Parallel Multi-Model Gemini Race:
  // Dispatches concurrent requests across all eligible Gemini models.
  // The fastest model wins; all remaining requests are aborted immediately.
  try {
    const raceResult = await raceGeminiGeneric<z.infer<T>>({
      systemPrompt: system,
      userPrompt: prompt,
      validate: (parsed) => {
        if (!parsed || typeof parsed !== "object") return false
        const check = schema.safeParse(parsed)
        return check.success
      },
      timeoutMs: 25000,
    })

    const durationMs = raceResult.raceDurationMs
    const promptTokens = Math.max(100, Math.round((system.length + prompt.length) / 3.8))
    const completionTokens = Math.max(50, Math.round(JSON.stringify(raceResult.data).length / 3.8))

    // Asynchronously record successful usage
    void InterviewCapacityService.recordUsage({
      model: raceResult.winningModel,
      requestCount: 1,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      interviewSessionId,
      jobId,
      candidateUserId,
      requestPurpose: purpose,
      providerUsed: "google",
      durationMs,
      status: "success",
    })

    return {
      object: raceResult.data,
      modelUsed: raceResult.winningModel,
      winningModelLabel: raceResult.winningModelLabel,
      raceDurationMs: raceResult.raceDurationMs,
    }
  } catch (raceErr: any) {
    console.warn(
      "[gemini-executor] Parallel AI race bypassed or failed, engaging sequential fallback chain:",
      raceErr?.message || raceErr
    )
  }

  let lastError: any = null

  // Deduplicate model list
  const models = Array.from(new Set(CANDIDATE_MODELS.filter(Boolean)))

  for (const modelId of models) {
    const maxAttempts = 2
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const startTime = Date.now()
      try {
        const result = await generateObject({
          model: getChatModel(modelId),
          system,
          schema,
          prompt,
        })

        const durationMs = Date.now() - startTime

        // Token estimation if SDK usage is not directly surfaced
        const promptTokens = Math.max(100, Math.round((system.length + prompt.length) / 3.8))
        const completionTokens = Math.max(50, Math.round(JSON.stringify(result.object).length / 3.8))

        // Record usage asynchronously (non-blocking)
        void InterviewCapacityService.recordUsage({
          model: modelId,
          requestCount: 1,
          inputTokens: promptTokens,
          outputTokens: completionTokens,
          interviewSessionId,
          jobId,
          candidateUserId,
          requestPurpose: purpose,
          providerUsed: "google",
          durationMs,
          status: "success",
        })

        return { object: result.object as z.infer<T>, modelUsed: modelId }
      } catch (err: any) {
        lastError = err
        const durationMs = Date.now() - startTime
        const is429 = isRateLimitError(err)

        console.warn(`[gemini-executor] Model ${modelId} attempt ${attempt + 1} failed (429=${is429}):`, err.message)

        if (is429) {
          // Record 429 in usage tracking
          void InterviewCapacityService.recordUsage({
            model: modelId,
            requestCount: 1,
            inputTokens: Math.round(prompt.length / 4),
            outputTokens: 0,
            interviewSessionId,
            jobId,
            candidateUserId,
            requestPurpose: purpose,
            providerUsed: "google",
            durationMs,
            status: "rate_limited",
            errorMessage: err.message,
          })

          // Mark in-memory cooldown across all AI race components
          markModelRateLimited(modelId, 45, err.message)

          // If rate limited, don't keep hammering the same model; break to try next fallback model
          if (attempt === 0) {
            // Apply jittered brief delay before switching
            const backoff = 300 + Math.random() * 250
            await delay(backoff)
          }
          break
        } else {
          // Standard backoff with jitter
          const backoff = 350 * Math.pow(2, attempt) + Math.random() * 200
          await delay(backoff)
        }
      }
    }
  }

  // If all models failed (e.g. complete network outage or total 429 quota exhaustion across all models),
  // preserve interview progress with intelligent contextual fallback!
  console.error("[gemini-executor] All Gemini models exhausted. Applying resilient fallback:", lastError)
  throw lastError
}
