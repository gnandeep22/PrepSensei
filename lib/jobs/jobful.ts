import "server-only"
import dns from "dns"
import { extractSkills } from "@/lib/skills"
import type { Job } from "@/lib/demo-data"

// Enforce IPv4 first to prevent Node.js fetch timeouts on dual-stack hosts
try {
  dns.setDefaultResultOrder("ipv4first")
} catch {
  // Ignore in environments where not supported
}

export type JobfulCategory =
  | "all"
  | "engineering"
  | "bank"
  | "railway"
  | "defence"
  | "teaching"
  | "all-india"
  | "state"

export type JobfulQuery = {
  query?: string
  category?: JobfulCategory
  stateCode?: string
  location?: string
  limit?: number
}

export type RawJobfulItem = {
  postDate: string
  board: string
  postName: string
  qualification: string
  advtNo: string
  lastDate: string
  url?: string
  category?: string
  state?: string
}

export const JOBFUL_STATE_MAP: { code: string; name: string; slug: string; aliases: string[] }[] = [
  { code: "AP", name: "Andhra Pradesh", slug: "ap-government-jobs", aliases: ["andhra", "amaravati", "visakhapatnam", "vizag", "vijayawada"] },
  { code: "TS", name: "Telangana", slug: "telangana-government-jobs", aliases: ["hyderabad", "secunderabad", "warangal"] },
  { code: "KA", name: "Karnataka", slug: "karnataka-government-jobs", aliases: ["bangalore", "bengaluru", "mysore", "hubli"] },
  { code: "MH", name: "Maharashtra", slug: "maharashtra-government-jobs", aliases: ["mumbai", "pune", "nagpur", "nashik"] },
  { code: "DL", name: "Delhi", slug: "delhi-government-jobs", aliases: ["delhi ncr", "new delhi", "ncr", "noida", "gurgaon", "gurugram"] },
  { code: "TN", name: "Tamil Nadu", slug: "tn-government-jobs", aliases: ["chennai", "coimbatore", "madurai"] },
  { code: "WB", name: "West Bengal", slug: "wb-government-jobs", aliases: ["kolkata", "calcutta", "howrah"] },
  { code: "UP", name: "Uttar Pradesh", slug: "up-government-jobs", aliases: ["lucknow", "kanpur", "varanasi", "noida"] },
  { code: "KL", name: "Kerala", slug: "kerala-government-jobs", aliases: ["kochi", "thiruvananthapuram", "trivandrum"] },
  { code: "GJ", name: "Gujarat", slug: "gujarat-government-jobs", aliases: ["ahmedabad", "gandhinagar", "surat", "vadodara"] },
  { code: "RJ", name: "Rajasthan", slug: "rajasthan-government-jobs", aliases: ["jaipur", "jodhpur", "udaipur"] },
  { code: "PB", name: "Punjab", slug: "punjab-government-jobs", aliases: ["chandigarh", "amritsar", "ludhiana"] },
  { code: "HR", name: "Haryana", slug: "haryana-government-jobs", aliases: ["gurgaon", "gurugram", "faridabad", "panchkula"] },
  { code: "MP", name: "Madhya Pradesh", slug: "mp-government-jobs", aliases: ["bhopal", "indore", "gwalior"] },
  { code: "BR", name: "Bihar", slug: "bihar-government-jobs", aliases: ["patna", "gaya"] },
  { code: "OR", name: "Odisha", slug: "odisha-government-jobs", aliases: ["bhubaneswar", "cuttack"] },
  { code: "AS", name: "Assam", slug: "assam-government-jobs", aliases: ["guwahati"] },
  { code: "JH", name: "Jharkhand", slug: "jharkhand-government-jobs", aliases: ["ranchi", "jamshedpur"] },
  { code: "CH", name: "Chhattisgarh", slug: "chhattisgarh-government-jobs", aliases: ["raipur", "bilaspur"] },
  { code: "UK", name: "Uttarakhand", slug: "uttarakhand-government-jobs", aliases: ["dehradun", "haridwar"] },
]

const CATEGORY_URLS: Record<string, string> = {
  engineering: "https://www.freejobalert.com/engineering-jobs/",
  bank: "https://www.freejobalert.com/bank-jobs/",
  railway: "https://www.freejobalert.com/railway-jobs/",
  defence: "https://www.freejobalert.com/police-defence-jobs/",
  teaching: "https://www.freejobalert.com/teaching-faculty-jobs/",
  "all-india": "https://www.freejobalert.com/government-jobs/",
  latest: "https://www.freejobalert.com/",
}

// 10-minute in-memory cache to prevent repetitive scraping
const cache = new Map<string, { timestamp: number; data: RawJobfulItem[] }>()
const CACHE_TTL_MS = 10 * 60 * 1000

function cleanText(str?: string): string {
  if (!str) return ""
  return str
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Parses tabular notifications from FreeJobAlert HTML. */
function parseTableRows(html: string, defaultCategory = "engineering", stateName = "India"): RawJobfulItem[] {
  const items: RawJobfulItem[] = []
  const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || []

  for (const table of tableMatches) {
    if (!table.includes("Post Date") && !table.includes("Recruitment Board")) continue
    const rows = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []
      if (cells.length < 4) continue

      const postDate = cleanText(cells[0])
      let board = cleanText(cells[1])
      let postName = cleanText(cells[2])
      let qualification = cells[3] ? cleanText(cells[3]) : ""
      let advtNo = cells[4] ? cleanText(cells[4]) : ""
      let lastDate = cells[5] ? cleanText(cells[5]) : ""

      // In some state layouts, cells[1] is post name or board title
      if (!postName && qualification) {
        postName = board
        board = stateName !== "India" ? `${stateName} Govt` : "Public Sector"
      }

      const linkMatch = row.match(/href="([^"]+)"/i)
      const url = linkMatch ? linkMatch[1] : undefined

      const lowerTitle = postName.toLowerCase()
      if (
        postName &&
        !lowerTitle.includes("no jobs are currently available") &&
        !lowerTitle.includes("answer key") &&
        !lowerTitle.includes("admit card") &&
        !lowerTitle.includes("result 20")
      ) {
        items.push({
          postDate,
          board: board || "Govt Recruitment Board",
          postName,
          qualification,
          advtNo: advtNo || "General Notice",
          lastDate: lastDate || "Check Notification",
          url,
          category: defaultCategory,
          state: stateName,
        })
      }
    }
  }

  return items
}

/** Fetch jobs from external Jobful-API microservice if configured or scrape directly. */
async function fetchJobfulCategory(category: string, url: string, stateName = "India"): Promise<RawJobfulItem[]> {
  const cacheKey = `${category}:${url}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  // 1. If an external jobful-api service is configured in .env.local, use its REST endpoints first
  const externalApiUrl = process.env.JOBFUL_API_URL?.replace(/\/$/, "")
  if (externalApiUrl) {
    try {
      let endpoint = `${externalApiUrl}/freejobalert`
      if (category === "engineering") endpoint += "/engineering-jobs"
      else if (category === "bank") endpoint += "/bank-jobs"
      else if (category === "railway") endpoint += "/railway-jobs"
      else if (category === "defence") endpoint += "/defence-jobs"
      else if (category === "teaching") endpoint += "/teaching-jobs"
      else if (category === "all-india") endpoint += "/gov/other-all-india-exam"

      const apiRes = await fetch(endpoint, {
        signal: AbortSignal.timeout(6000),
        headers: { Accept: "application/json" },
      })
      if (apiRes.ok) {
        const rawJson = await apiRes.json()
        if (Array.isArray(rawJson) && rawJson.length > 0) {
          const items: RawJobfulItem[] = rawJson.map((item: any) => ({
            postDate: item.postDate || item.date || "Recent",
            board: item.postBoard || item.board || "Govt Board",
            postName: item.postName || item.title || "Job Notification",
            qualification: item.qualification || "",
            advtNo: item.advtNo || "",
            lastDate: item.lastDate || "",
            url: item.link || item.url,
            category,
            state: stateName,
          }))
          cache.set(cacheKey, { timestamp: Date.now(), data: items })
          return items
        }
      }
    } catch {
      // Fallback to built-in scraper on external API timeout/error
    }
  }

  // 2. Built-in scraper engine directly parsing freejobalert notifications
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`FreeJobAlert responded ${res.status} for ${url}`)
  }

  const html = await res.text()
  const items = parseTableRows(html, category, stateName)
  cache.set(cacheKey, { timestamp: Date.now(), data: items })
  return items
}

/** Extract qualification degrees and skills for matching with candidate profile. */
function extractJobfulSkills(qualification: string, title: string): string[] {
  const evidence = `${title} ${qualification}`
  const foundSkills = extractSkills(evidence)

  const degreeKeywords = [
    { pattern: /\b(b\.?tech|b\.?e)\b/i, name: "B.Tech/B.E" },
    { pattern: /\b(m\.?tech|m\.?e)\b/i, name: "M.Tech" },
    { pattern: /\b(mca)\b/i, name: "MCA" },
    { pattern: /\b(diploma)\b/i, name: "Diploma" },
    { pattern: /\b(b\.?sc)\b/i, name: "B.Sc" },
    { pattern: /\b(m\.?sc)\b/i, name: "M.Sc" },
    { pattern: /\b(degree|graduate)\b/i, name: "Graduate" },
    { pattern: /\b(mba)\b/i, name: "MBA" },
    { pattern: /\b(computer science|it|information tech)\b/i, name: "Computer Science" },
    { pattern: /\b(electrical)\b/i, name: "Electrical" },
    { pattern: /\b(mechanical)\b/i, name: "Mechanical" },
    { pattern: /\b(civil)\b/i, name: "Civil" },
    { pattern: /\b(electronics)\b/i, name: "Electronics" },
  ]

  for (const { pattern, name } of degreeKeywords) {
    if (pattern.test(evidence) && !foundSkills.includes(name)) {
      foundSkills.push(name)
    }
  }

  return foundSkills.length ? foundSkills.slice(0, 8) : ["B.Tech/B.E", "Degree", "Engineering"]
}

/** Determine job type (Full-time, Contract, Internship). */
function parseJobType(title: string, qualification: string): Job["type"] {
  const combined = `${title} ${qualification}`.toLowerCase()
  if (combined.includes("intern") || combined.includes("apprentice") || combined.includes("trainee")) {
    return "Internship"
  }
  if (combined.includes("contract") || combined.includes("walk in") || combined.includes("temporary") || combined.includes("project")) {
    return "Contract"
  }
  return "Full-time"
}

/** Convert raw Jobful item into standard PrepSensei Job model. */
export function normalizeJobfulItem(item: RawJobfulItem, index: number): Job {
  const idSafeBoard = item.board.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20)
  const idSafePost = item.postName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)
  const id = `jobful-${item.category || "gov"}-${idSafeBoard}-${idSafePost}-${index}`

  const location = item.state && item.state !== "India" ? `${item.state}, India` : "India"
  const type = parseJobType(item.postName, item.qualification)
  const requiredSkills = extractJobfulSkills(item.qualification, item.postName)

  const parts = [
    `Official recruitment notification by ${item.board} for ${item.postName}.`,
    item.qualification ? `Eligibility / Qualification: ${item.qualification}.` : "",
    item.advtNo && item.advtNo !== "–" ? `Advertisement No: ${item.advtNo}.` : "",
    item.lastDate ? `Application Deadline: ${item.lastDate}.` : "",
  ].filter(Boolean)

  return {
    id,
    title: item.postName,
    company: item.board,
    location,
    type,
    experience: item.qualification.toLowerCase().includes("exp") ? "Experienced" : "Fresher / Graduate",
    salary: item.category === "bank" ? "Bank Scale (Pay Level as per IBPS / Board)" : "Govt / PSU Scale (as per 7th CPC / Board norms)",
    requiredSkills,
    description: parts.join(" "),
    posted: item.postDate || "Recent",
    url: item.url,
    source: "jobful",
  }
}

/**
 * Fetch live job notifications from Jobful API (freejobalert scraper)
 * Supports query filtering, category selection, and state filtering.
 */
export async function fetchJobfulJobs(query: JobfulQuery = {}): Promise<Job[]> {
  const { query: searchKeyword = "", category = "all", location, stateCode, limit = 40 } = query

  let items: RawJobfulItem[] = []

  // Check if query or location matches a specific Indian state
  let matchedState = JOBFUL_STATE_MAP.find(
    (s) =>
      (stateCode && s.code.toUpperCase() === stateCode.toUpperCase()) ||
      (location && (s.name.toLowerCase().includes(location.toLowerCase()) || s.aliases.some((a) => location.toLowerCase().includes(a))))
  )

  if (matchedState) {
    try {
      const stateUrl = `https://www.freejobalert.com/${matchedState.slug}/`
      const stateItems = await fetchJobfulCategory("state", stateUrl, matchedState.name)
      items.push(...stateItems)
    } catch (e) {
      console.warn(`[Jobful] Failed to fetch state jobs for ${matchedState.name}:`, e)
    }
  }

  // Fetch relevant categories based on requested category or default "all"
  const categoriesToFetch: { cat: string; url: string }[] = []
  if (category === "all") {
    // Default: fetch Engineering, Bank, Railway, and Defence
    categoriesToFetch.push(
      { cat: "engineering", url: CATEGORY_URLS.engineering },
      { cat: "bank", url: CATEGORY_URLS.bank },
      { cat: "railway", url: CATEGORY_URLS.railway },
    )
  } else if (CATEGORY_URLS[category]) {
    categoriesToFetch.push({ cat: category, url: CATEGORY_URLS[category] })
  }

  // Execute category fetches in parallel
  const fetched = await Promise.allSettled(
    categoriesToFetch.map(({ cat, url }) => fetchJobfulCategory(cat, url))
  )

  for (const res of fetched) {
    if (res.status === "fulfilled") {
      items.push(...res.value)
    }
  }

  // Filter by search keyword if provided
  if (searchKeyword.trim()) {
    const q = searchKeyword.toLowerCase().trim()
    items = items.filter(
      (item) =>
        item.postName.toLowerCase().includes(q) ||
        item.board.toLowerCase().includes(q) ||
        item.qualification.toLowerCase().includes(q)
    )
  }

  // Deduplicate items by title and board
  const seen = new Set<string>()
  const deduped: RawJobfulItem[] = []
  for (const item of items) {
    const key = `${item.board.toLowerCase()}:${item.postName.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(item)
    }
  }

  return deduped.slice(0, limit).map((item, idx) => normalizeJobfulItem(item, idx))
}
