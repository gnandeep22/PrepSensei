import "server-only"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

export function getChatModel(modelName = "gemini-2.5-flash") {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey })
    return google(modelName) as any
  }
  return "openai/gpt-4o-mini" as any
}

export function getEmbeddingModel() {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey })
    return google.textEmbeddingModel("text-embedding-004") as any
  }
  return "openai/text-embedding-3-small" as any
}
