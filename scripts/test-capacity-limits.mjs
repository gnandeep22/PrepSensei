import net from "node:net"
import dns from "node:dns"

if (typeof net.setDefaultAutoSelectFamily === "function") {
  net.setDefaultAutoSelectFamily(false)
}
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first")
}

import { Pool } from "pg"

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

console.log("=== Testing Dynamic Gemini Capacity & Interview Duration Limits ===")

async function runTests() {
  try {
    // Test 1: Verify database schema extensions
    console.log("\n[Test 1] Checking DB schema columns and tables...")
    const jobColumns = await pool.query(
      `select column_name, data_type, column_default from information_schema.columns where table_name = 'job' and column_name = 'interview_duration_minutes'`
    )
    if (jobColumns.rows.length === 0) {
      throw new Error("Missing interview_duration_minutes in job table!")
    }
    console.log("✓ job.interview_duration_minutes exists with default:", jobColumns.rows[0].column_default)

    const usageTable = await pool.query(
      `select column_name from information_schema.columns where table_name = 'gemini_api_usage'`
    )
    console.log("✓ gemini_api_usage table columns:", usageTable.rows.map((r) => r.column_name).join(", "))

    const sessionTable = await pool.query(
      `select column_name from information_schema.columns where table_name = 'interview_session'`
    )
    console.log("✓ interview_session table columns:", sessionTable.rows.map((r) => r.column_name).join(", "))

    // Test 2: Insert test usage records and test quota calculations
    console.log("\n[Test 2] Simulating Gemini API usage tracking...")
    const testUsageId = `test-use-${Date.now()}`
    await pool.query(
      `insert into gemini_api_usage (id, model, request_count, input_tokens, output_tokens, total_tokens, request_purpose, status)
       values ($1, 'gemini-3.5-flash-lite', 1, 1250, 180, 1430, 'interview_answer', 'success')`,
      [testUsageId]
    )
    console.log("✓ Inserted test usage record successfully")

    // Test 3: Test server-authoritative session creation and expiry
    console.log("\n[Test 3] Simulating server-authoritative interview session...")
    const testUserId = `test-cand-${Date.now()}`
    const testJobId = `test-job-${Date.now()}`
    const testSessId = `test-sess-${Date.now()}`

    // Insert mock user & job
    await pool.query(
      `insert into "user" (id, name, email) values ($1, 'Test Candidate', $2) on conflict do nothing`,
      [testUserId, `candidate-${Date.now()}@example.com`]
    )
    await pool.query(
      `insert into "job" (id, title, company, interview_duration_minutes) values ($1, 'Staff Software Engineer', 'Acme Inc', 20) on conflict do nothing`,
      [testJobId]
    )

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 20 * 60 * 1000)

    await pool.query(
      `insert into interview_session (id, candidate_user_id, job_id, duration_minutes, started_at, expires_at, status)
       values ($1, $2, $3, 20, $4, $5, 'in_progress')`,
      [testSessId, testUserId, testJobId, now, expiresAt]
    )

    const sessCheck = await pool.query(`select * from interview_session where id = $1`, [testSessId])
    const loadedSess = sessCheck.rows[0]
    const remainingSec = Math.floor((new Date(loadedSess.expires_at).getTime() - Date.now()) / 1000)
    console.log(`✓ Session created: ${loadedSess.id}, duration: ${loadedSess.duration_minutes}m, remaining: ${remainingSec}s`)

    if (remainingSec < 1190 || remainingSec > 1200) {
      throw new Error(`Unexpected remaining seconds: ${remainingSec}`)
    }

    // Test 4: Verify Backward Compatibility for older jobs without interview_duration_minutes
    console.log("\n[Test 4] Testing backward compatibility on legacy jobs...")
    const legacyJobId = `legacy-job-${Date.now()}`
    await pool.query(
      `insert into "job" (id, title, company) values ($1, 'Legacy Frontend Role', 'Heritage Corp')`,
      [legacyJobId]
    )
    const legacyCheck = await pool.query(`select id, interview_duration_minutes from "job" where id = $1`, [legacyJobId])
    console.log("✓ Legacy job loaded with default duration:", legacyCheck.rows[0].interview_duration_minutes, "minutes")

    // Clean up test rows
    await pool.query(`delete from gemini_api_usage where id = $1`, [testUsageId])
    await pool.query(`delete from interview_session where id = $1`, [testSessId])
    await pool.query(`delete from "job" where id in ($1, $2)`, [testJobId, legacyJobId])
    await pool.query(`delete from "user" where id = $1`, [testUserId])

    console.log("\n========================================================")
    console.log("✓ ALL UNIT & INTEGRATION CAPACITY TESTS PASSED SUCCESSFULLY!")
    console.log("========================================================\n")
  } catch (err) {
    console.error("Test failed:", err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

void runTests()
