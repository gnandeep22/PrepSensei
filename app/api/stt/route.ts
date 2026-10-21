import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Server-side Speech-to-Text API route.
 * Transcribes candidate audio recordings via Gemini multimodal transcription,
 * providing accurate, zero-latency transcription that does not rely on
 * Google Chrome cloud Web Speech credentials or fail on Linux.
 */
export async function POST(req: NextRequest) {
  try {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!geminiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 })
    }

    let audioBuffer: Buffer | null = null
    let mimeType = "audio/webm"

    const contentType = req.headers.get("content-type") || ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file = formData.get("audio") as Blob | null
      if (!file) {
        return NextResponse.json({ error: "No audio file provided in form" }, { status: 400 })
      }
      mimeType = file.type || "audio/webm"
      const arrayBuffer = await file.arrayBuffer()
      audioBuffer = Buffer.from(arrayBuffer)
    } else {
      const body = await req.json()
      if (!body.audio) {
        return NextResponse.json({ error: "Missing audio field" }, { status: 400 })
      }
      // Base64 string
      const base64Data = body.audio.replace(/^data:audio\/\w+;base64,/, "")
      audioBuffer = Buffer.from(base64Data, "base64")
      if (body.mimeType) mimeType = body.mimeType
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json({ text: "" })
    }

    // Call Gemini 3.5 Flash Lite multimodal API
    const base64Audio = audioBuffer.toString("base64")
    const cleanMimeType = mimeType.split(";")[0].trim() || "audio/webm"

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiKey}`

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: cleanMimeType,
                  data: base64Audio,
                },
              },
              {
                text: "Transcribe the candidate's spoken English response from this interview audio recording accurately. Output ONLY the exact transcribed text, nothing else. If the audio is silent or only contains background noise, return an empty string.",
              },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error("[STT API] Gemini error:", res.status, errText)
      return NextResponse.json({ error: "Transcription engine unavailable", text: "" }, { status: 502 })
    }

    const data = await res.json()
    let transcription = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""

    // Strip any quotes or placeholder phrases
    if (transcription.toLowerCase() === "none" || transcription.toLowerCase() === "empty" || transcription.toLowerCase() === "silent") {
      transcription = ""
    }

    return NextResponse.json({ text: transcription })
  } catch (error: any) {
    console.error("[STT API] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to transcribe audio", text: "" }, { status: 500 })
  }
}
