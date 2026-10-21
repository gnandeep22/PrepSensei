import assert from "node:assert"

const BASE_URL = "http://localhost:3001"

async function runTests() {
  console.log("=== 1. Testing Page Serving ===")
  const resSignIn = await fetch(`${BASE_URL}/sign-in`)
  assert.strictEqual(resSignIn.status, 200, "Sign-in page should return 200")
  console.log("✓ /sign-in loaded successfully (200)")

  const resSignUp = await fetch(`${BASE_URL}/sign-up`)
  assert.strictEqual(resSignUp.status, 200, "Sign-up page should return 200")
  console.log("✓ /sign-up loaded successfully (200)")

  console.log("\n=== 2. Testing Candidate Authentication ===")
  const timestamp = Date.now()
  const candidateEmail = `candidate_${timestamp}@example.com`
  const password = "Password123!"

  const signupRes = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE_URL },
    body: JSON.stringify({
      name: "Test Candidate",
      email: candidateEmail,
      password,
      role: "candidate",
    }),
  })
  assert.strictEqual(signupRes.status, 200, `Signup should succeed, got ${signupRes.status}`)
  const setCookie = signupRes.headers.get("set-cookie")
  assert.ok(setCookie, "Signup should return session cookie")
  console.log("✓ Candidate signed up successfully")

  // Extract session cookie
  const cookie = setCookie.split(";")[0]

  console.log("\n=== 3. Testing Face Status (Before Registration) ===")
  const statusRes1 = await fetch(`${BASE_URL}/api/face`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ action: "status" }),
  })
  const statusData1 = await statusRes1.json()
  assert.strictEqual(statusData1.registered, false, "Candidate should not be registered initially")
  console.log("✓ Correctly reported unregistered status:", statusData1)

  console.log("\n=== 4. Testing Face Registration ===")
  // Create sample 128-d vector
  const descriptor1 = Array.from({ length: 128 }, (_, i) => Math.sin(i / 10))

  const registerRes = await fetch(`${BASE_URL}/api/face`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      action: "register",
      descriptor: descriptor1,
      livenessVerified: true,
      smileDetected: true,
      blinkDetected: true,
    }),
  })
  assert.strictEqual(registerRes.status, 200, "Registration should succeed")
  const regData = await registerRes.json()
  assert.strictEqual(regData.ok, true, "Registration response ok should be true")
  console.log("✓ Face registered with 128-d descriptor and liveness data")

  console.log("\n=== 5. Testing Face Status (After Registration) ===")
  const statusRes2 = await fetch(`${BASE_URL}/api/face`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ action: "status" }),
  })
  const statusData2 = await statusRes2.json()
  assert.strictEqual(statusData2.registered, true, "Candidate should now be registered")
  assert.strictEqual(statusData2.livenessVerified, true, "Liveness should be verified")
  console.log("✓ Registered status confirmed:", statusData2)

  console.log("\n=== 6. Testing Identity Verification (Match vs Mismatch) ===")
  // Matching descriptor (slight noise)
  const matchingDescriptor = descriptor1.map((v) => v + (Math.random() - 0.5) * 0.02)
  const verifyMatchRes = await fetch(`${BASE_URL}/api/face`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      action: "verify",
      descriptor: matchingDescriptor,
    }),
  })
  const verifyMatchData = await verifyMatchRes.json()
  assert.strictEqual(verifyMatchData.verified, true, "Should verify matching descriptor")
  console.log("✓ Matching face correctly verified:", verifyMatchData)

  // Mismatching descriptor (completely different face)
  const mismatchDescriptor = Array.from({ length: 128 }, (_, i) => Math.cos((i + 50) / 2))
  const verifyMismatchRes = await fetch(`${BASE_URL}/api/face`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      action: "verify",
      descriptor: mismatchDescriptor,
    }),
  })
  const verifyMismatchData = await verifyMismatchRes.json()
  assert.strictEqual(verifyMismatchData.verified, false, "Should reject mismatching descriptor")
  console.log("✓ Mismatching face correctly rejected:", verifyMismatchData)

  console.log("\n=== 7. Testing Interview Face Analysis Submission ===")
  const mockReport = {
    identityVerified: true,
    matchCount: 45,
    mismatchCount: 1,
    multipleFaceCount: 0,
    noFaceCount: 1,
    gazeTowardPercent: 88,
    gazeAwayPercent: 12,
    prolongedGazeAwayCount: 1,
    mouthMovementPercent: 65,
    speakingIntervals: [
      { startSec: 2, endSec: 18 },
      { startSec: 24, endSec: 50 },
    ],
    silentIntervals: [
      { startSec: 18, endSec: 24 },
      { startSec: 50, endSec: 60 },
    ],
    events: [
      { type: "face_match", timestamp: 2 },
      { type: "gaze_away", timestamp: 20, duration: 4 },
      { type: "mouth_moving", timestamp: 25 },
    ],
    totalDurationSec: 60,
    analyzedAt: new Date().toISOString(),
  }

  const postReportRes = await fetch(`${BASE_URL}/api/face/analysis`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      report: mockReport,
      submissionId: "demo-sub-1",
    }),
  })
  assert.strictEqual(postReportRes.status, 200, "Saving report should succeed")
  const postReportData = await postReportRes.json()
  assert.strictEqual(postReportData.ok, true, "Save report ok should be true")
  console.log("✓ Interview face report saved successfully:", postReportData)

  console.log("\n=== 8. Testing Candidate Querying Own Analysis ===")
  const getCandidateReportRes = await fetch(`${BASE_URL}/api/face/analysis`, {
    method: "GET",
    headers: {
      Cookie: cookie,
    },
  })
  assert.strictEqual(getCandidateReportRes.status, 200, "Candidate query should succeed")
  const candidateReportData = await getCandidateReportRes.json()
  assert.ok(candidateReportData.analyses?.length > 0, "Analyses array should not be empty")
  assert.strictEqual(candidateReportData.analyses[0].report.gazeTowardPercent, 88)
  console.log("✓ Candidate successfully fetched their own analysis report")

  console.log("\n=== 9. Testing Recruiter Access to Candidate Analysis ===")
  const recruiterEmail = `recruiter_${timestamp}@example.com`
  const recruiterSignup = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE_URL },
    body: JSON.stringify({
      name: "Lead Recruiter",
      email: recruiterEmail,
      password,
      role: "recruiter",
    }),
  })
  const recruiterCookie = recruiterSignup.headers.get("set-cookie")?.split(";")[0]

  const getRecruiterReportRes = await fetch(
    `${BASE_URL}/api/face/analysis?submissionId=demo-sub-1`,
    {
      method: "GET",
      headers: {
        Cookie: recruiterCookie,
      },
    },
  )
  assert.strictEqual(getRecruiterReportRes.status, 200, "Recruiter query should succeed")
  const recruiterReportData = await getRecruiterReportRes.json()
  assert.ok(recruiterReportData.analyses?.length > 0, "Recruiter should retrieve the report")
  console.log("✓ Recruiter successfully retrieved the candidate's interview face report")

  console.log("\n=== ALL AUTOMATED VALIDATION CHECKS PASSED SUCCESSFULLY ===")
}

runTests().catch((err) => {
  console.error("Test failed:", err)
  process.exit(1)
})
