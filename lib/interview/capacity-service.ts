import "server-only"
import { db } from "@/lib/db"
import { geminiApiUsage, interviewSession, job as jobTable } from "@/lib/db/schema"
import { eq, and, gt, gte, count, sql } from "drizzle-orm"

/**
 * Interface representing configured or measured Gemini API quota parameters.
 */
export interface GeminiQuotaConfig {
  model: string
  fallbackModel: string
  rpmQuota: number
  tpmQuota: number
  rpdQuota: number
  safetyMarginPercent: number
  otherFeaturesReservePercent: number
  modelContextWindow: number
  modelMaxOutputTokens: number
  provider: string
  fallbackProvider: string
  isConfiguredEstimate: boolean
}

export interface DurationConsumptionEstimate {
  durationMinutes: number
  expectedQuestions: number
  expectedRequests: number
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedTotalTokens: number
  peakRpmPerCandidate: number
  peakTpmPerCandidate: number
  safe: boolean
  disqualificationReason?: string
}

export interface CapacityStatusReport {
  configuredModel: string
  provider: string
  fallbackModel: string
  fallbackProvider: string
  maxSafeDurationMinutes: number
  minDurationMinutes: number
  durationIncrementMinutes: number
  availableDurations: number[]
  activeInterviewsCount: number
  capacityStatus: "healthy" | "constrained" | "degraded" | "critical"
  isEstimate: boolean
  source: string
  quotas: {
    rpm: number
    tpm: number
    rpd: number
    safetyMarginPercent: number
    otherFeaturesReservePercent: number
    effectiveInterviewRpm: number
    effectiveInterviewTpm: number
    effectiveInterviewRpd: number
  }
  runtimeUsage: {
    recentRpm: number
    recentTpm: number
    recentDailyRequests: number
    activeInterviewsCount: number
    inCooldown: boolean
    cooldownRemainingSec?: number
    activeModel: string
  }
  durationEvaluations: DurationConsumptionEstimate[]
  recommendation: string
}

/**
 * Load Administrator-Configured Quota Values.
 * Reads environment variables with realistic defaults reflecting Google AI Studio tiers.
 */
function getQuotaConfig(): GeminiQuotaConfig {
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite"
  const rpmQuota = parseInt(process.env.GEMINI_QUOTA_RPM || "15", 10)
  const tpmQuota = parseInt(process.env.GEMINI_QUOTA_TPM || "250000", 10)
  const rpdQuota = parseInt(process.env.GEMINI_QUOTA_RPD || "1000", 10)

  // Enforce minimum 20% safety reserve as mandated by specification
  const rawSafety = parseInt(process.env.GEMINI_SAFETY_MARGIN_PERCENT || "25", 10)
  const safetyMarginPercent = Math.max(20, Number.isFinite(rawSafety) ? rawSafety : 25)

  const rawReserve = parseInt(process.env.GEMINI_OTHER_FEATURES_RESERVE_PERCENT || "20", 10)
  const otherFeaturesReservePercent = Math.max(10, Math.min(50, Number.isFinite(rawReserve) ? rawReserve : 20))

  return {
    model,
    fallbackModel,
    rpmQuota: rpmQuota > 0 ? rpmQuota : 15,
    tpmQuota: tpmQuota > 0 ? tpmQuota : 250000,
    rpdQuota: rpdQuota > 0 ? rpdQuota : 1000,
    safetyMarginPercent,
    otherFeaturesReservePercent,
    modelContextWindow: 1048576, // 1M tokens for Gemini Flash
    modelMaxOutputTokens: 8192,
    provider: "google",
    fallbackProvider: "google-secondary",
    isConfiguredEstimate: true,
  }
}

/**
 * Conservative estimation of Gemini API requests and token consumption for a given duration.
 * Based on empirical human candidate pacing (~2.2 minutes per Q&A turn).
 */
export function estimateConsumptionForDuration(durationMinutes: number): DurationConsumptionEstimate {
  // Pacing: 2.2 minutes per turn (reading question, formulating thought, speech/text response, AI response presentation)
  const expectedQuestions = Math.max(2, Math.min(15, Math.round(durationMinutes / 2.2)))
  // 1 opening question + expected answer evaluation turns
  const expectedRequests = expectedQuestions + 1

  // Start turn: ~1100 input tokens (candidate profile + JD + RAG reference context), ~100 output tokens
  const openingInput = 1100
  const openingOutput = 100

  // Evaluation turns: input grows as transcript accumulates (+160 tokens per turn)
  let evalInputSum = 0
  let evalOutputSum = 0

  for (let i = 1; i <= expectedQuestions; i++) {
    const turnInput = 1200 + i * 160
    evalInputSum += turnInput
    // Intermediate turns generate ~180 output tokens; final evaluation turn generates ~350 tokens
    evalOutputSum += i === expectedQuestions ? 350 : 180
  }

  const estimatedInputTokens = openingInput + evalInputSum
  const estimatedOutputTokens = openingOutput + evalOutputSum
  const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens

  // Candidate burst rate: worst case candidate answers quickly (approx 0.85 requests per minute)
  const peakRpmPerCandidate = 0.85
  // Peak TPM: average tokens per minute scaled by 1.35 burst factor for longer responses
  const peakTpmPerCandidate = Math.ceil((estimatedTotalTokens / Math.max(5, durationMinutes)) * 1.35)

  return {
    durationMinutes,
    expectedQuestions,
    expectedRequests,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens,
    peakRpmPerCandidate,
    peakTpmPerCandidate,
    safe: true,
  }
}

export class InterviewCapacityService {
  /**
   * Query recent runtime usage from database and active interview sessions.
   */
  public static async getRuntimeMetrics() {
    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    let recentRpm = 0
    let recentTpm = 0
    let recentDailyRequests = 0
    let activeInterviewsCount = 0
    let recent429Count = 0

    try {
      // 1. Query usage in the last 60 seconds (RPM & TPM)
      const recentUsage = await db
        .select({
          reqCount: sql<number>`coalesce(sum(${geminiApiUsage.requestCount}), 0)`,
          totTokens: sql<number>`coalesce(sum(${geminiApiUsage.totalTokens}), 0)`,
        })
        .from(geminiApiUsage)
        .where(gte(geminiApiUsage.createdAt, oneMinuteAgo))

      if (recentUsage[0]) {
        recentRpm = Number(recentUsage[0].reqCount) || 0
        recentTpm = Number(recentUsage[0].totTokens) || 0
      }

      // 2. Query usage in the last 24 hours (RPD)
      const dailyUsage = await db
        .select({
          reqCount: sql<number>`coalesce(sum(${geminiApiUsage.requestCount}), 0)`,
        })
        .from(geminiApiUsage)
        .where(gte(geminiApiUsage.createdAt, oneDayAgo))

      if (dailyUsage[0]) {
        recentDailyRequests = Number(dailyUsage[0].reqCount) || 0
      }

      // 3. Query 429 rate limit errors in the last 60 seconds
      const rateLimitCheck = await db
        .select({ count: count() })
        .from(geminiApiUsage)
        .where(
          and(
            gte(geminiApiUsage.createdAt, oneMinuteAgo),
            eq(geminiApiUsage.status, "rate_limited")
          )
        )

      if (rateLimitCheck[0]) {
        recent429Count = Number(rateLimitCheck[0].count) || 0
      }

      // 4. Query active in-progress interviews
      const activeSessions = await db
        .select({ count: count() })
        .from(interviewSession)
        .where(
          and(
            eq(interviewSession.status, "in_progress"),
            gt(interviewSession.expiresAt, now)
          )
        )

      if (activeSessions[0]) {
        activeInterviewsCount = Number(activeSessions[0].count) || 0
      }
    } catch (err) {
      console.warn("[InterviewCapacityService] Database metrics query warning:", err)
    }

    // Check in-memory global model status map if available
    let inCooldown = recent429Count > 0
    let cooldownRemainingSec = inCooldown ? 45 : 0
    let activeModel = getQuotaConfig().model

    if (typeof globalThis !== "undefined" && (globalThis as any)._prepSenseiModelStatuses) {
      const statusMap = (globalThis as any)._prepSenseiModelStatuses as Map<string, any>
      const currentModelStatus = statusMap.get(activeModel)
      if (currentModelStatus && currentModelStatus.status === "rate_limited") {
        inCooldown = true
        cooldownRemainingSec = Math.max(cooldownRemainingSec, currentModelStatus.remainingSec || 30)
      }
    }

    return {
      recentRpm,
      recentTpm,
      recentDailyRequests,
      activeInterviewsCount,
      recent429Count,
      inCooldown,
      cooldownRemainingSec,
      activeModel,
    }
  }

  /**
   * Calculate comprehensive capacity status and maximum safe interview duration.
   */
  public static async getCapacityReport(): Promise<CapacityStatusReport> {
    const config = getQuotaConfig()
    const metrics = await this.getRuntimeMetrics()

    // Deduct safety margin and other feature reserves
    const interviewQuotaRatio = Math.max(
      0.1,
      1 - (config.safetyMarginPercent + config.otherFeaturesReservePercent) / 100
    )

    const effectiveInterviewRpm = config.rpmQuota * interviewQuotaRatio
    const effectiveInterviewTpm = config.tpmQuota * interviewQuotaRatio
    const effectiveInterviewRpd = config.rpdQuota * interviewQuotaRatio

    // Reserve capacity for existing active interviews:
    // Each active candidate interview holds an ongoing reservation of ~0.85 RPM and ~1800 TPM
    const activeReservedRpm = metrics.activeInterviewsCount * 0.85
    const activeReservedTpm = metrics.activeInterviewsCount * 1800
    const activeReservedRpd = metrics.activeInterviewsCount * 6

    const availableRpm = Math.max(0, effectiveInterviewRpm - metrics.recentRpm - activeReservedRpm)
    const availableTpm = Math.max(0, effectiveInterviewTpm - metrics.recentTpm - activeReservedTpm)
    const availableRpd = Math.max(0, effectiveInterviewRpd - metrics.recentDailyRequests - activeReservedRpd)

    // Evaluate all 5-minute increments up to 60 minutes
    const testDurations = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]
    const evaluations: DurationConsumptionEstimate[] = []

    let maxSafeDuration = 5

    for (const duration of testDurations) {
      const est = estimateConsumptionForDuration(duration)
      let safe = true
      let reason: string | undefined

      // If currently experiencing 429 errors or active cooldown
      if (metrics.inCooldown && duration > 10) {
        safe = false
        reason = `Gemini API is currently cooling down (${metrics.cooldownRemainingSec || 30}s remaining). Durations over 10m temporarily restricted.`
      }
      // Check RPM constraint
      else if (est.peakRpmPerCandidate > availableRpm) {
        safe = false
        reason = `Exceeds safe RPM quota (${est.peakRpmPerCandidate.toFixed(2)} req/min needed, only ${availableRpm.toFixed(2)} safe RPM available across ${metrics.activeInterviewsCount} active interviews).`
      }
      // Check TPM constraint
      else if (est.peakTpmPerCandidate > availableTpm) {
        safe = false
        reason = `Exceeds safe TPM quota (${est.peakTpmPerCandidate.toLocaleString()} tokens/min needed, only ${Math.round(availableTpm).toLocaleString()} safe TPM available).`
      }
      // Check RPD constraint
      else if (est.expectedRequests > availableRpd) {
        safe = false
        reason = `Exceeds daily request capacity (${est.expectedRequests} requests needed, only ${Math.round(availableRpd)} safe daily requests available).`
      }

      est.safe = safe
      est.disqualificationReason = reason
      evaluations.push(est)

      if (safe && duration >= maxSafeDuration) {
        maxSafeDuration = duration
      }
    }

    // Determine overall capacity status
    let capacityStatus: "healthy" | "constrained" | "degraded" | "critical" = "healthy"
    if (metrics.inCooldown || availableRpm < 1.0) {
      capacityStatus = "critical"
    } else if (availableRpm < 2.5 || availableTpm < 15000) {
      capacityStatus = "constrained"
    } else if (maxSafeDuration <= 15) {
      capacityStatus = "degraded"
    }

    // List of allowed safe durations
    const availableDurations = evaluations.filter((e) => e.safe).map((e) => e.durationMinutes)

    const recommendation =
      availableDurations.length > 0
        ? `Maximum available interview duration: ${maxSafeDuration} minutes.`
        : "Gemini capacity is currently severely constrained. Minimum 5 minutes recommended."

    return {
      configuredModel: config.model,
      provider: config.provider,
      fallbackModel: config.fallbackModel,
      fallbackProvider: config.fallbackProvider,
      maxSafeDurationMinutes: maxSafeDuration,
      minDurationMinutes: 5,
      durationIncrementMinutes: 5,
      availableDurations: availableDurations.length > 0 ? availableDurations : [5],
      activeInterviewsCount: metrics.activeInterviewsCount,
      capacityStatus,
      isEstimate: config.isConfiguredEstimate,
      source: "configured_quota_with_runtime_tracking",
      quotas: {
        rpm: config.rpmQuota,
        tpm: config.tpmQuota,
        rpd: config.rpdQuota,
        safetyMarginPercent: config.safetyMarginPercent,
        otherFeaturesReservePercent: config.otherFeaturesReservePercent,
        effectiveInterviewRpm: Math.round(effectiveInterviewRpm * 100) / 100,
        effectiveInterviewTpm: Math.round(effectiveInterviewTpm),
        effectiveInterviewRpd: Math.round(effectiveInterviewRpd),
      },
      runtimeUsage: {
        recentRpm: metrics.recentRpm,
        recentTpm: metrics.recentTpm,
        recentDailyRequests: metrics.recentDailyRequests,
        activeInterviewsCount: metrics.activeInterviewsCount,
        inCooldown: metrics.inCooldown,
        cooldownRemainingSec: metrics.cooldownRemainingSec,
        activeModel: metrics.activeModel,
      },
      durationEvaluations: evaluations,
      recommendation,
    }
  }

  /**
   * Validate that a recruiter's requested duration is acceptable given current capacity.
   */
  public static async validateDuration(durationMinutes: number): Promise<{
    valid: boolean
    maxSafeDurationMinutes: number
    reason?: string
  }> {
    if (typeof durationMinutes !== "number" || !Number.isInteger(durationMinutes)) {
      return { valid: false, maxSafeDurationMinutes: 15, reason: "Duration must be an integer number of minutes." }
    }
    if (durationMinutes < 5) {
      return { valid: false, maxSafeDurationMinutes: 15, reason: "Minimum allowed interview duration is 5 minutes." }
    }
    if (durationMinutes % 5 !== 0) {
      return { valid: false, maxSafeDurationMinutes: 15, reason: "Interview duration must be configured in 5-minute increments (e.g. 5, 10, 15, 20)." }
    }

    const report = await this.getCapacityReport()

    if (durationMinutes > report.maxSafeDurationMinutes) {
      const match = report.durationEvaluations.find((e) => e.durationMinutes === durationMinutes)
      const detail = match?.disqualificationReason || `Selected duration (${durationMinutes}m) exceeds the maximum safe duration of ${report.maxSafeDurationMinutes}m.`
      return {
        valid: false,
        maxSafeDurationMinutes: report.maxSafeDurationMinutes,
        reason: detail,
      }
    }

    return {
      valid: true,
      maxSafeDurationMinutes: report.maxSafeDurationMinutes,
    }
  }

  /**
   * Check runtime quota before a candidate starts an interview.
   * Atomically checks available capacity and creates a server-authoritative session.
   */
  public static async canStartInterview(durationMinutes: number): Promise<{
    allowed: boolean
    reason?: string
    retryAfterSec?: number
  }> {
    const report = await this.getCapacityReport()

    if (report.capacityStatus === "critical") {
      return {
        allowed: false,
        reason: "Interview capacity is temporarily limited due to high concurrent load or Gemini API cooldown. Please wait a moment.",
        retryAfterSec: report.runtimeUsage.cooldownRemainingSec || 30,
      }
    }

    if (durationMinutes > report.maxSafeDurationMinutes) {
      return {
        allowed: false,
        reason: `Current API capacity only supports up to ${report.maxSafeDurationMinutes} minutes per interview.`,
        retryAfterSec: 30,
      }
    }

    return { allowed: true }
  }

  /**
   * Create or resume a server-authoritative interview session.
   */
  public static async createOrResumeSession(params: {
    candidateUserId: string
    jobId: string
    assessmentId?: string
    requestedDurationMinutes?: number
  }) {
    const { candidateUserId, jobId, assessmentId } = params
    const now = new Date()

    // 1. Check if candidate already has an active in-progress session for this job
    const existing = await db
      .select()
      .from(interviewSession)
      .where(
        and(
          eq(interviewSession.candidateUserId, candidateUserId),
          eq(interviewSession.jobId, jobId),
          eq(interviewSession.status, "in_progress")
        )
      )
      .limit(1)

    if (existing[0]) {
      const sess = existing[0]
      const remainingMs = sess.expiresAt.getTime() - now.getTime()
      if (remainingMs > 0) {
        // Return existing active session without modifying its expiry time!
        return {
          session: sess,
          isNew: false,
          remainingSeconds: Math.floor(remainingMs / 1000),
          isExpired: false,
        }
      } else {
        // Mark session as expired
        await db
          .update(interviewSession)
          .set({ status: "expired", endedAt: now, updatedAt: now })
          .where(eq(interviewSession.id, sess.id))
      }
    }

    // 2. Determine duration from Job configuration (or fallback requested)
    let durationMinutes = params.requestedDurationMinutes || 15
    try {
      const [jobRow] = await db
        .select({ duration: jobTable.interviewDurationMinutes })
        .from(jobTable)
        .where(eq(jobTable.id, jobId))
        .limit(1)

      if (jobRow?.duration && jobRow.duration >= 5) {
        durationMinutes = jobRow.duration
      }
    } catch (e) {
      console.warn("[InterviewCapacityService] Could not read job duration from DB, using fallback:", e)
    }

    // 3. Pre-flight capacity check
    const capacityCheck = await this.canStartInterview(durationMinutes)
    if (!capacityCheck.allowed) {
      throw new Error(capacityCheck.reason || "Insufficient Gemini API capacity to start interview.")
    }

    // 4. Create new server-authoritative session
    const sessionId = `session-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000)

    const [newSession] = await db
      .insert(interviewSession)
      .values({
        id: sessionId,
        candidateUserId,
        jobId,
        assessmentId: assessmentId || null,
        durationMinutes,
        startedAt: now,
        expiresAt,
        status: "in_progress",
        currentTurn: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return {
      session: newSession,
      isNew: true,
      remainingSeconds: durationMinutes * 60,
      isExpired: false,
    }
  }

  /**
   * Record Gemini API request and token usage in database.
   */
  public static async recordUsage(params: {
    model: string
    requestCount?: number
    inputTokens?: number
    outputTokens?: number
    interviewSessionId?: string
    jobId?: string
    candidateUserId?: string
    requestPurpose: string
    providerUsed?: string
    durationMs?: number
    status?: "success" | "rate_limited" | "error"
    errorMessage?: string
  }) {
    try {
      const id = `use-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`
      const reqCount = params.requestCount ?? 1
      const inTok = params.inputTokens ?? 0
      const outTok = params.outputTokens ?? 0
      const totalTok = inTok + outTok

      await db.insert(geminiApiUsage).values({
        id,
        model: params.model,
        requestCount: reqCount,
        inputTokens: inTok,
        outputTokens: outTok,
        totalTokens: totalTok,
        interviewSessionId: params.interviewSessionId || null,
        jobId: params.jobId || null,
        candidateUserId: params.candidateUserId || null,
        requestPurpose: params.requestPurpose,
        providerUsed: params.providerUsed || "google",
        durationMs: params.durationMs || null,
        status: params.status || "success",
        errorMessage: params.errorMessage || null,
      })
    } catch (err) {
      // Non-blocking so usage recording never crashes the interview loop
      console.warn("[InterviewCapacityService] Failed to record usage row:", err)
    }
  }
}
