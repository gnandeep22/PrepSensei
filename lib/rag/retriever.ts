import "server-only"
import { embed, embedMany, cosineSimilarity } from "ai"
import { knowledgeBase, type KbCategory } from "@/lib/rag/knowledge"

/**
 * Minimal but genuine RAG pipeline:
 *   documents -> chunking -> embeddings (cached) -> similarity retrieval
 *
 * Embeddings for the knowledge base are computed once per server instance and
 * cached in memory, so repeated interviews do not re-embed the corpus.
 */

import { getEmbeddingModel } from "@/lib/ai/model"

type Chunk = { topic: string; category: KbCategory; text: string }

/** Split a document into small chunks of ~2 sentences each. */
function chunkText(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [text]
  const chunks: string[] = []
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(" "))
  }
  return chunks
}

// Build the chunk list once (pure, synchronous).
const chunks: Chunk[] = knowledgeBase.flatMap((doc) =>
  chunkText(doc.text).map((text) => ({ topic: doc.topic, category: doc.category, text })),
)

let cachedEmbeddings: number[][] | null = null

async function getChunkEmbeddings(): Promise<number[][]> {
  if (cachedEmbeddings) return cachedEmbeddings
  const { embeddings } = await embedMany({ model: getEmbeddingModel(), values: chunks.map((c) => c.text) })
  cachedEmbeddings = embeddings
  return embeddings
}

export type RetrievedChunk = { topic: string; text: string; score: number }

/**
 * Retrieve the top-k most relevant chunks for a query. Chunks are first
 * filtered to the requested interview category (technical / behavioral / hr)
 * so a behavioral interview does not surface database trivia, then ranked by
 * cosine similarity against the query embedding.
 */
export async function retrieveContext(options: {
  query: string
  category: KbCategory
  k?: number
}): Promise<RetrievedChunk[]> {
  const { query, category, k = 4 } = options
  try {
    const embeddings = await getChunkEmbeddings()
    const { embedding: queryEmbedding } = await embed({ model: getEmbeddingModel(), value: query })

    const scored = chunks.map((chunk, i) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, embeddings[i]),
    }))

    const inCategory = scored.filter((s) => s.chunk.category === category)
    const pool = inCategory.length > 0 ? inCategory : scored

    return pool
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((s) => ({ topic: s.chunk.topic, text: s.chunk.text, score: s.score }))
  } catch {
    // Keyword-based fallback when embedding model is unavailable or rate-limited
    const words = new Set(query.toLowerCase().split(/\W+/).filter((w) => w.length > 2))
    const inCategory = chunks.filter((c) => c.category === category)
    const pool = inCategory.length > 0 ? inCategory : chunks
    return pool
      .map((chunk) => {
        const textWords = chunk.text.toLowerCase().split(/\W+/)
        const matches = textWords.filter((w) => words.has(w)).length
        return { topic: chunk.topic, text: chunk.text, score: matches / (textWords.length || 1) }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
  }
}
