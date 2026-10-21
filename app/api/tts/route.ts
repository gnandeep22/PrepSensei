import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Text-to-Speech API route.
 * Generates natural audio/mpeg for interview questions so candidates on any OS
 * (including Linux without local speech-dispatcher/espeak installed) can hear
 * the AI interviewer loud and clear.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rawText = searchParams.get("text") || ""
    if (!rawText.trim()) {
      return new NextResponse("Missing text parameter", { status: 400 })
    }

    // Clean markdown, symbols, and extra whitespace for natural pronunciation
    const cleanText = rawText
      .replace(/[*_#`~]/g, "")
      .replace(/\s+/g, " ")
      .trim()

    // Break text into natural sentences (up to ~180 chars each) for Google TTS chunks
    const sentenceMatches = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText]
    const chunks: string[] = []

    for (const s of sentenceMatches) {
      const trimmed = s.trim()
      if (!trimmed) continue
      if (trimmed.length <= 180) {
        chunks.push(trimmed)
      } else {
        // Split long sentence by commas or words
        const words = trimmed.split(" ")
        let current = ""
        for (const w of words) {
          if ((current + " " + w).length <= 180) {
            current = current ? current + " " + w : w
          } else {
            if (current) chunks.push(current)
            current = w
          }
        }
        if (current) chunks.push(current)
      }
    }

    // Fetch and assemble MP3 chunks
    const buffers: Buffer[] = []
    for (const chunk of chunks.slice(0, 10)) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(chunk)}`
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      })
      if (res.ok) {
        const ab = await res.arrayBuffer()
        buffers.push(Buffer.from(ab))
      }
    }

    if (buffers.length === 0) {
      return new NextResponse("Failed to generate speech", { status: 502 })
    }

    const mergedMp3 = Buffer.concat(buffers)

    return new NextResponse(mergedMp3, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": mergedMp3.length.toString(),
        "Cache-Control": "public, max-age=604800, immutable",
      },
    })
  } catch (error: any) {
    console.error("[TTS API] Error generating audio:", error)
    return new NextResponse(error.message || "TTS internal error", { status: 500 })
  }
}
