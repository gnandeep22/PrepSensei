/**
 * PrepSensei — lib/ai/gemini-race.ts
 *
 * Multi-Model Gemini AI Race Engine & Quota/Rate-Limit Cooldown System
 * Inspired by SplitSmart's parallel AI race architecture.
 *
 * Features:
 * - Concurrent parallel racing across available Gemini models.
 * - Quota error detection (429, RESOURCE_EXHAUSTED, RPM/RPD, zero quota, 404).
 * - Automatic Retry-After parsing and live cooldown tracking.
 * - Winner-takes-all cancellation: first valid response wins, others are aborted immediately.
 * - Automatic recovery when cooldown expires.
 * - Safe fallback to deterministic RAG shortlisting when all models are in cooldown.
 */

export interface GeminiModelConfig {
  id: string
  label: string
  category: "fast" | "stable" | "preview"
  description: string
}

export const GEMINI_RACING_MODELS: GeminiModelConfig[] = [
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", category: "fast", description: "Ultra-low latency lightweight Flash model" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", category: "fast", description: "High-throughput responsive Flash-Lite" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", category: "stable", description: "Balanced general-purpose multimodal Flash" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", category: "stable", description: "Enhanced reliability and structured output" },
  { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash", category: "stable", description: "High reasoning capacity Flash model" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", category: "stable", description: "Flagship next-gen Flash architecture" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", category: "preview", description: "Experimental bleeding-edge Flash preview" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", category: "preview", description: "Advanced complex multi-step reasoning" },
  { id: "gemini-flash-latest", label: "Gemini Flash (Latest)", category: "stable", description: "Default latest stable Flash endpoint" },
]

export const DEFAULT_RACING_MODELS = GEMINI_RACING_MODELS.map((m) => m.id)

export function getModelLabel(modelId: string): string {
  const found = GEMINI_RACING_MODELS.find((m) => m.id === modelId)
  return found?.label || modelId
}

export interface ModelStatusRecord {
  id: string
  label: string
  category: "fast" | "stable" | "preview"
  status: "available" | "rate_limited" | "daily_limited" | "zero_quota" | "billing_restricted" | "unsupported" | "error"
  statusLabel: string
  isZeroQuota: boolean
  retryAfter: number | null
  retryDelaySec: number | null
  remainingSec: number | null
  reason: string | null
  lastChecked: number
}

// In-memory global store on server (persists across requests during runtime)
declare global {
  var _prepSenseiModelStatuses: Map<string, Partial<ModelStatusRecord>> | undefined
}

const modelStatusMap: Map<string, Partial<ModelStatusRecord>> =
  globalThis._prepSenseiModelStatuses ?? new Map()

if (process.env.NODE_ENV !== "production") {
  globalThis._prepSenseiModelStatuses = modelStatusMap
}

/**
 * Parse retry delay from string (e.g. "21s", "12879s") or number.
 */
export function parseRetryDelay(delayVal: any): number | null {
  if (!delayVal) return null
  if (typeof delayVal === "number" && Number.isFinite(delayVal) && delayVal > 0) {
    return Math.round(delayVal)
  }
  const match = String(delayVal).trim().match(/^([\d.]+)\s*s?$/i)
  if (match) {
    const val = parseFloat(match[1])
    return Number.isFinite(val) && val > 0 ? Math.ceil(val) : null
  }
  return null
}

/**
 * Parse Retry-After header (seconds or HTTP date).
 */
export function parseRetryAfterHeader(headers: Headers | Record<string, string> | null): number | null {
  if (!headers) return null
  const raw =
    typeof (headers as any).get === "function"
      ? (headers as any).get("retry-after")
      : (headers as any)["retry-after"] || (headers as any)["Retry-After"]

  if (!raw) return null
  const asNum = Number(raw)
  if (Number.isFinite(asNum) && asNum > 0) {
    return Math.ceil(asNum)
  }
  const parsedDate = Date.parse(raw)
  if (!Number.isNaN(parsedDate)) {
    return Math.max(1, Math.ceil((parsedDate - Date.now()) / 1000))
  }
  return null
}

/**
 * Classify a Gemini API error into structured quota/rate-limit details.
 */
export function classifyQuotaError(
  status: number,
  errBody: any,
  headers: Headers | Record<string, string> | null = null
): {
  isQuota: boolean
  type: ModelStatusRecord["status"]
  statusLabel: string
  isZeroQuota: boolean
  isTemporary: boolean
  retryDelaySec: number | null
  retryAfter: number | null
  reason: string
} {
  const is429 = status === 429
  const bodyObj = errBody && typeof errBody === "object" ? errBody : {}
  const errorObj = bodyObj.error || (typeof errBody === "object" ? errBody : {})
  const message = String(errorObj.message || (typeof errBody === "string" ? errBody : "") || "")
  const errorStatus = String(errorObj.status || "")
  const details: any[] = Array.isArray(errorObj.details) ? errorObj.details : []

  const errorInfo = details.find((d) => d && typeof d === "object" && String(d["@type"] || "").includes("ErrorInfo"))
  const retryInfo = details.find((d) => d && typeof d === "object" && String(d["@type"] || "").includes("RetryInfo"))
  const quotaFailure = details.find((d) => d && typeof d === "object" && String(d["@type"] || "").includes("QuotaFailure"))

  const metadata = errorInfo && typeof errorInfo.metadata === "object" ? errorInfo.metadata : {}
  const violations = Array.isArray(quotaFailure?.violations) ? quotaFailure.violations : []
  const violationDescriptions = violations.map((v) => v.description || "").join(" ")

  const allText = `${message} ${errorStatus} ${violationDescriptions} ${JSON.stringify(metadata)}`
  const isResourceExhausted =
    is429 || errorStatus === "RESOURCE_EXHAUSTED" || /RESOURCE_EXHAUSTED|QUOTA_EXCEEDED|RATE_LIMIT_EXCEEDED/i.test(allText)

  if (!isResourceExhausted && !/quota|rate\s*limit|per\s*minute|billing/i.test(allText)) {
    if (status === 404 || /not\s*found|no\s*longer\s*available/i.test(allText)) {
      return {
        isQuota: true,
        type: "unsupported",
        statusLabel: "Not supported",
        isZeroQuota: true,
        isTemporary: false,
        retryDelaySec: null,
        retryAfter: null,
        reason: "Model endpoint is not accessible or retired on this key (HTTP 404).",
      }
    }
    return {
      isQuota: false,
      type: "error",
      statusLabel: "Error",
      isZeroQuota: false,
      isTemporary: false,
      retryDelaySec: null,
      retryAfter: null,
      reason: message || `HTTP ${status}`,
    }
  }

  // Extract retry delay from RetryInfo or HTTP header
  const retryDelaySec = parseRetryDelay(retryInfo?.retryDelay) || parseRetryAfterHeader(headers)

  // 1. Check for Zero Free Tier Quota
  const quotaLimit = metadata.quota_limit !== undefined ? String(metadata.quota_limit).trim() : null
  const isZeroLimit =
    quotaLimit === "0" ||
    /quota\s*limit\s*['":]?\s*0\b/i.test(allText) ||
    /limit\s*['":]?\s*0\b/i.test(allText) ||
    /free\s*tier.*(?:quota\s*(?:is|of)\s*0|not\s*supported|unavailable|zero)/i.test(allText) ||
    /quota\s*(?:of|is)\s*0\b/i.test(allText)

  if (isZeroLimit) {
    return {
      isQuota: true,
      type: "zero_quota",
      statusLabel: "Free Tier unavailable",
      isZeroQuota: true,
      isTemporary: false,
      retryDelaySec: null,
      retryAfter: null,
      reason: "Free Tier quota is 0 for this model on this API key.",
    }
  }

  // 2. Billing or account restriction
  if (status === 403 || /billing\s*(?:disabled|not\s*enabled|required)|BILLING_DISABLED/i.test(allText)) {
    return {
      isQuota: true,
      type: "billing_restricted",
      statusLabel: "Billing required",
      isZeroQuota: true,
      isTemporary: false,
      retryDelaySec: null,
      retryAfter: null,
      reason: "Billing account is required for this model.",
    }
  }

  // 3. Requests-Per-Day (RPD) limit
  if (
    metadata.quota_metric?.includes("requests_per_day") ||
    /requests?[\s_]*per[\s_]*day|RPD|daily\s*(?:request|quota)/i.test(allText)
  ) {
    const delay = retryDelaySec || 86400
    return {
      isQuota: true,
      type: "daily_limited",
      statusLabel: "Daily quota exceeded",
      isZeroQuota: false,
      isTemporary: true,
      retryDelaySec: delay,
      retryAfter: Date.now() + delay * 1000,
      reason: "Daily request quota exceeded. Resets on new day.",
    }
  }

  // 4. Rate-limit RPM / Fallback
  const delay = retryDelaySec || 60
  return {
    isQuota: true,
    type: "rate_limited",
    statusLabel: "Rate limited",
    isZeroQuota: false,
    isTemporary: true,
    retryDelaySec: delay,
    retryAfter: Date.now() + delay * 1000,
    reason: `Rate limit reached. Retry in ${delay}s.`,
  }
}

/**
 * Get the current availability status of a model.
 * Automatically clears expired temporary rate limits.
 */
export function getModelStatus(modelId: string): ModelStatusRecord {
  const config = GEMINI_RACING_MODELS.find((m) => m.id === modelId) || {
    id: modelId,
    label: modelId,
    category: "stable" as const,
    description: "",
  }

  let record = modelStatusMap.get(modelId)

  if (!record) {
    const fresh: ModelStatusRecord = {
      id: modelId,
      label: config.label,
      category: config.category,
      status: "available",
      statusLabel: "Available",
      isZeroQuota: false,
      retryAfter: null,
      retryDelaySec: null,
      remainingSec: null,
      reason: null,
      lastChecked: Date.now(),
    }
    modelStatusMap.set(modelId, fresh)
    return fresh
  }

  // Auto-recover if cooldown has expired
  if (record.retryAfter && Date.now() >= record.retryAfter) {
    record.status = "available"
    record.statusLabel = "Available"
    record.retryAfter = null
    record.retryDelaySec = null
    record.reason = null
    record.lastChecked = Date.now()
  }

  const remainingSec = record.retryAfter ? Math.max(1, Math.ceil((record.retryAfter - Date.now()) / 1000)) : null

  return {
    id: modelId,
    label: config.label,
    category: config.category,
    status: record.status || "available",
    statusLabel: record.statusLabel || "Available",
    isZeroQuota: Boolean(record.isZeroQuota),
    retryAfter: record.retryAfter || null,
    retryDelaySec: record.retryDelaySec || null,
    remainingSec,
    reason: record.reason || null,
    lastChecked: record.lastChecked || Date.now(),
  }
}

/**
 * Returns statuses of all registered racing models.
 */
export function getAllModelStatuses(): ModelStatusRecord[] {
  return GEMINI_RACING_MODELS.map((m) => getModelStatus(m.id))
}

/**
 * Check whether a model is eligible to participate in the race.
 */
export function isModelEligibleForRacing(modelId: string): boolean {
  const info = getModelStatus(modelId)
  if (info.isZeroQuota) return false
  if (info.status === "billing_restricted") return false
  if (info.status === "unsupported") return false
  if (info.retryAfter && Date.now() < info.retryAfter) return false
  return true
}

/**
 * Filter models to only those currently eligible to race.
 */
export function getEligibleRacingModels(models: string[] = DEFAULT_RACING_MODELS): string[] {
  return models.filter(isModelEligibleForRacing)
}

/**
 * Update model status after an error.
 */
export function updateModelStatus(modelId: string, classification: ReturnType<typeof classifyQuotaError>) {
  const current = getModelStatus(modelId)
  const updated: Partial<ModelStatusRecord> = {
    ...current,
    status: classification.type,
    statusLabel: classification.statusLabel,
    isZeroQuota: Boolean(classification.isZeroQuota),
    retryAfter: classification.retryAfter || null,
    retryDelaySec: classification.retryDelaySec || null,
    reason: classification.reason,
    lastChecked: Date.now(),
  }
  modelStatusMap.set(modelId, updated)
  return updated
}

/**
 * Mark a model as successfully verified / available.
 */
export function markModelSuccess(modelId: string) {
  const current = getModelStatus(modelId)
  const updated: Partial<ModelStatusRecord> = {
    ...current,
    status: "available",
    statusLabel: "Available",
    isZeroQuota: false,
    retryAfter: null,
    retryDelaySec: null,
    reason: null,
    lastChecked: Date.now(),
  }
  modelStatusMap.set(modelId, updated)
  return updated
}

/**
 * Parallel AI Race Runner:
 * Calls all eligible Gemini models concurrently.
 * First valid structured response wins; others are aborted immediately.
 */
export async function raceGeminiShortlist(options: {
  apiKey: string
  systemPrompt: string
  userPrompt: string
  candidateModels?: string[]
  timeoutMs?: number
}): Promise<{
  data: any
  winningModel: string
  winningModelLabel: string
  raceDurationMs: number
  participatingModels: string[]
  modelStatuses: ModelStatusRecord[]
}> {
  const { apiKey, systemPrompt, userPrompt, timeoutMs = 45000 } = options
  const allCandidates = options.candidateModels && options.candidateModels.length > 0
    ? options.candidateModels
    : DEFAULT_RACING_MODELS

  const eligibleModels = getEligibleRacingModels(allCandidates)

  // If no models eligible, throw so caller can invoke deterministic fallback
  if (eligibleModels.length === 0) {
    throw new Error("ALL_MODELS_IN_COOLDOWN")
  }

  const masterAbort = new AbortController()
  const timeoutId = setTimeout(() => masterAbort.abort(), timeoutMs)
  const startTime = Date.now()

  let isRaceSettled = false
  const modelOutcomes: Array<{ model: string; error?: any; status?: number }> = []

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nRespond strictly with valid JSON conforming to the requested schema. No markdown wrapping.`

  const bodyString = JSON.stringify({
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  })

  try {
    const result = await new Promise<{ data: any; winningModel: string }>((resolve, reject) => {
      let pendingCount = eligibleModels.length

      const checkAllDone = () => {
        if (isRaceSettled) return
        if (pendingCount <= 0) {
          isRaceSettled = true
          clearTimeout(timeoutId)
          reject(new Error("All racing models failed to return a valid response"))
        }
      }

      eligibleModels.forEach((modelId) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`

        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: masterAbort.signal,
          body: bodyString,
        })
          .then(async (res) => {
            if (isRaceSettled) return

            if (!res.ok) {
              const errBody = await res.json().catch(() => null)
              const quotaClass = classifyQuotaError(res.status, errBody, res.headers)
              updateModelStatus(modelId, quotaClass)
              modelOutcomes.push({ model: modelId, status: res.status, error: quotaClass.reason })
              return
            }

            const jsonResponse = await res.json()
            if (isRaceSettled) return

            const rawText = jsonResponse.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("")
            if (!rawText || !rawText.trim()) {
              modelOutcomes.push({ model: modelId, error: "Empty candidate text" })
              return
            }

            const cleanJson = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
            let parsed: any
            try {
              parsed = JSON.parse(cleanJson)
            } catch (parseErr) {
              modelOutcomes.push({ model: modelId, error: "Invalid JSON format" })
              return
            }

            // Verify basic report structure
            if (!parsed.ranking || !Array.isArray(parsed.ranking)) {
              modelOutcomes.push({ model: modelId, error: "Missing ranking array" })
              return
            }

            // FIRST VALID MODEL WINS!
            isRaceSettled = true
            clearTimeout(timeoutId)
            masterAbort.abort() // Cancel all other pending network requests immediately

            markModelSuccess(modelId)
            resolve({ data: parsed, winningModel: modelId })
          })
          .catch((err) => {
            if (err.name !== "AbortError") {
              modelOutcomes.push({ model: modelId, error: err.message })
            }
          })
          .finally(() => {
            pendingCount--
            checkAllDone()
          })
      })
    })

    const duration = Date.now() - startTime

    return {
      data: result.data,
      winningModel: result.winningModel,
      winningModelLabel: getModelLabel(result.winningModel),
      raceDurationMs: duration,
      participatingModels: eligibleModels,
      modelStatuses: getAllModelStatuses(),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
