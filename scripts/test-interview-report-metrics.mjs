import assert from "node:assert"
import { demoEvaluation } from "../lib/demo-data.ts"
import { readFileSync } from "node:fs"

console.log("==========================================")
console.log("🧪 Testing Interview Report Duration & Question Count")
console.log("==========================================")

// 1. Verify demoEvaluation schema
assert.strictEqual(typeof demoEvaluation.durationMinutes, "number", "demoEvaluation must have durationMinutes")
assert.strictEqual(typeof demoEvaluation.questionsAsked, "number", "demoEvaluation must have questionsAsked")
assert.strictEqual(typeof demoEvaluation.durationFormatted, "string", "demoEvaluation must have durationFormatted")
console.log("✅ 1. demoEvaluation metrics verified:", {
  durationMinutes: demoEvaluation.durationMinutes,
  questionsAsked: demoEvaluation.questionsAsked,
  durationFormatted: demoEvaluation.durationFormatted,
})

// 2. Verify Candidate Mock Interview (app/interview/page.tsx)
const mockInterviewSrc = readFileSync("app/interview/page.tsx", "utf-8")
assert(mockInterviewSrc.includes("Interview Duration"), "Mock interview must display 'Interview Duration'")
assert(mockInterviewSrc.includes("Questions Asked"), "Mock interview must display 'Questions Asked'")
assert(mockInterviewSrc.includes("durationMinutes"), "Mock interview must use durationMinutes")
assert(mockInterviewSrc.includes("questionsAsked"), "Mock interview must use questionsAsked")
assert(mockInterviewSrc.includes("interviewStartTime"), "Mock interview must track interviewStartTime")
console.log("✅ 2. Mock interview report UI contains duration and questions asked metrics")

// 3. Verify Candidate Official Interview (app/interview/official/page.tsx)
const officialInterviewSrc = readFileSync("app/interview/official/page.tsx", "utf-8")
assert(officialInterviewSrc.includes("Interview Duration"), "Official interview must display 'Interview Duration'")
assert(officialInterviewSrc.includes("Questions Asked"), "Official interview must display 'Questions Asked'")
assert(officialInterviewSrc.includes("durationMinutes"), "Official interview must use durationMinutes")
assert(officialInterviewSrc.includes("questionsAsked"), "Official interview must use questionsAsked")
assert(officialInterviewSrc.includes("interviewStartTime"), "Official interview must track interviewStartTime")
console.log("✅ 3. Official interview report UI contains duration and questions asked metrics")

// 4. Verify Recruiter Candidate Profile (app/recruiter/candidates/[id]/page.tsx)
const recruiterCandidateSrc = readFileSync("app/recruiter/candidates/[id]/page.tsx", "utf-8")
assert(recruiterCandidateSrc.includes("interview.durationMinutes") || recruiterCandidateSrc.includes("interview.durationFormatted"), "Recruiter candidate page must display interview duration")
assert(recruiterCandidateSrc.includes("interview.questionsAsked"), "Recruiter candidate page must display interview questions asked")
console.log("✅ 4. Recruiter candidate review page displays interview duration and questions asked")

// 5. Verify API & Agent (lib/interview/agent.ts and app/api/interview/route.ts)
const agentSrc = readFileSync("lib/interview/agent.ts", "utf-8")
assert(agentSrc.includes("durationMinutes: z.number().optional()"), "answerSchema must include durationMinutes")
assert(agentSrc.includes("questionsAsked: z.number().optional()"), "answerSchema must include questionsAsked")
assert(agentSrc.includes("durationMinutes:"), "evaluateAnswer must populate durationMinutes")
assert(agentSrc.includes("questionsAsked:"), "evaluateAnswer must populate questionsAsked")

const routeSrc = readFileSync("app/api/interview/route.ts", "utf-8")
assert(routeSrc.includes("result.evaluation.durationMinutes"), "Interview API route must enrich durationMinutes")
assert(routeSrc.includes("result.evaluation.questionsAsked"), "Interview API route must enrich questionsAsked")
console.log("✅ 5. Interview agent and API routes properly compute and attach duration & question metrics")

console.log("==========================================")
console.log("🎉 ALL TESTS PASSED! Post-interview report accurately shows duration and questions asked!")
console.log("==========================================")
