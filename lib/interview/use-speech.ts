"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Universal voice helpers for the face-to-face interview:
 *   - useSpeechSynthesis: Plays question speech via high-quality audio /api/tts
 *     with Web Speech API fallback, ensuring audio works on all OSs (including Linux)
 *     and is never muted or dropped by browser bugs.
 *   - useSpeechRecognition: Robust real-time transcription combining persistent
 *     MediaStream hardware handle (prevents OS "microphone stopped" notifications and
 *     rapid on/off flips), native MediaRecorder with Gemini server-side /api/stt,
 *     and guarded Web Speech API.
 */

/* ------------------------------- TTS ------------------------------- */

export function useSpeechSynthesis() {
  const [supported, setSupported] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const activeUtterancesRef = useRef<Set<any>>(new Set())

  useEffect(() => {
    if (typeof window === "undefined") return

    if ("speechSynthesis" in window) {
      const pickVoice = () => {
        try {
          const voices = window.speechSynthesis.getVoices()
          if (!voices || !voices.length) return
          voiceRef.current =
            voices.find((v) => /en(-|_)?(US|GB)/i.test(v.lang) && /natural|google|samantha|daniel|jenny|guy/i.test(v.name)) ??
            voices.find((v) => v.lang.toLowerCase().startsWith("en")) ??
            voices[0]
        } catch { /* ignore */ }
      }
      pickVoice()
      window.speechSynthesis.onvoiceschanged = pickVoice
    }

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null
        try { window.speechSynthesis.cancel() } catch {}
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
    }
  }, [])

  const cancel = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel()
      } catch {}
    }
    setSpeaking(false)
  }, [])

  /** Speak `text`. Plays via natural server-side audio stream or Web Speech fallback. */
  const speak = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (!text || !text.trim()) {
          resolve()
          return
        }

        cancel()
        setSpeaking(true)

        let finished = false
        const finish = () => {
          if (finished) return
          finished = true
          setSpeaking(false)
          resolve()
        }

        // Primary: Audio stream from /api/tts (guaranteed audible on Linux and all browsers)
        try {
          const audio = new Audio(`/api/tts?text=${encodeURIComponent(text.trim())}`)
          currentAudioRef.current = audio
          audio.preload = "auto"

          audio.onended = () => {
            currentAudioRef.current = null
            finish()
          }

          audio.onerror = () => {
            currentAudioRef.current = null
            fallbackWebSpeech(text, finish)
          }

          const playPromise = audio.play()
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.warn("Audio play prevented, trying Web Speech fallback:", err)
              fallbackWebSpeech(text, finish)
            })
          }
        } catch (err) {
          fallbackWebSpeech(text, finish)
        }

        function fallbackWebSpeech(phrase: string, onDone: () => void) {
          if (typeof window === "undefined" || !("speechSynthesis" in window)) {
            onDone()
            return
          }
          try {
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance(phrase)
            utterance.lang = "en-US"
            utterance.rate = 1.0
            utterance.pitch = 1.0
            utterance.volume = 1.0
            if (voiceRef.current) utterance.voice = voiceRef.current

            // Retain reference to prevent V8 garbage collection bug in Chromium
            activeUtterancesRef.current.add(utterance)

            utterance.onend = () => {
              activeUtterancesRef.current.delete(utterance)
              onDone()
            }
            utterance.onerror = () => {
              activeUtterancesRef.current.delete(utterance)
              onDone()
            }

            setTimeout(() => {
              try {
                window.speechSynthesis.speak(utterance)
              } catch {
                onDone()
              }
            }, 40)
          } catch {
            onDone()
          }
        }
      }),
    [cancel],
  )

  return { supported, speaking, speak, cancel }
}

/* ------------------------------- STT ------------------------------- */

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null
}

export function useSpeechRecognition() {
  const [supported, setSupported] = useState(true)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [interim, setInterim] = useState("")
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [silenceSeconds, setSilenceSeconds] = useState(0)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const restartTimerRef = useRef<any>(null)
  const webSpeechDisabledRef = useRef(false)
  const activeRef = useRef(false)
  const finalRef = useRef("")

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // VAD & 5-Second Silence Detection
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSpeechTimeRef = useRef<number>(0)
  const hasSpokenRef = useRef<boolean>(false)
  const isAutoFlushingRef = useRef<boolean>(false)

  // Transcribe recorded audio blob using server-side Gemini STT API
  const transcribeAudioBlob = useCallback(async (blob: Blob) => {
    if (!blob || blob.size < 400) return
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append("audio", blob, "recording.webm")

      const res = await fetch("/api/stt", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.text?.trim()
        if (text) {
          finalRef.current = finalRef.current ? `${finalRef.current} ${text}` : text
          setTranscript(finalRef.current)
        }
      }
    } catch (err) {
      console.warn("[STT] Transcription error:", err)
    } finally {
      setIsTranscribing(false)
    }
  }, [])

  // Persistent MediaStream handle to prevent Linux hardware release / notification spam
  const getAudioStream = useCallback(async (): Promise<MediaStream | null> => {
    if (mediaStreamRef.current && mediaStreamRef.current.active) {
      return mediaStreamRef.current
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return null
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStreamRef.current = stream
      return stream
    } catch (err) {
      console.warn("Could not acquire microphone stream:", err)
      return null
    }
  }, [])

  // Initialize Web Speech API with STRICT guard against rapid restart loops
  useEffect(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return

    try {
      const recognition = new Ctor()
      recognition.lang = "en-US"
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event: any) => {
        let interimText = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            const phrase = result[0]?.transcript?.trim()
            if (phrase) {
              finalRef.current = finalRef.current ? `${finalRef.current} ${phrase}` : phrase
            }
          } else {
            interimText += result[0]?.transcript || ""
          }
        }
        const fullText = [finalRef.current, interimText.trim()].filter(Boolean).join(" ").trim()
        setTranscript(fullText)
        setInterim(interimText)
      }

      recognition.onerror = (event: any) => {
        const err = event?.error
        // 'no-speech' is a normal pause when candidate thinks
        // 'aborted' is intentional pause when interviewer is speaking
        if (err === "no-speech" || err === "aborted") return

        console.warn("[WebSpeech] Speech error warning:", err)
        if (err === "not-allowed" || err === "service-not-allowed") {
          webSpeechDisabledRef.current = true
          setListening(false)
        }
      }

      recognition.onend = () => {
        // When actively listening, smoothly resume recognition after pauses so words appear with zero lag
        if (activeRef.current && !webSpeechDisabledRef.current) {
          clearTimeout(restartTimerRef.current)
          restartTimerRef.current = setTimeout(() => {
            if (activeRef.current && !webSpeechDisabledRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start()
              } catch {
                // If already running or recycling, ignore
              }
            }
          }, 250)
        }
      }

      recognitionRef.current = recognition
    } catch (err) {
      console.warn("Web Speech API init failed:", err)
      webSpeechDisabledRef.current = true
    }

    return () => {
      activeRef.current = false
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null
          recognitionRef.current.onerror = null
          recognitionRef.current.onend = null
          recognitionRef.current.abort()
        } catch {}
        recognitionRef.current = null
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
      }
    }
  }, [])

  const start = useCallback(async () => {
    activeRef.current = true
    setListening(true)
    hasSpokenRef.current = false
    setSilenceSeconds(0)

    // 1. Maintain single continuous hardware mic stream (stops OS notification flipping)
    const stream = await getAudioStream()
    if (stream) {
      stream.getAudioTracks().forEach((t) => (t.enabled = true))

      // 2. Setup Web Audio API Analyser for Voice Activity Detection
      try {
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
          if (AudioCtx) {
            const ctx = new AudioCtx()
            const source = ctx.createMediaStreamSource(stream)
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 512
            source.connect(analyser)
            audioContextRef.current = ctx
            analyserRef.current = analyser
          }
        } else if (audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume().catch(() => {})
        }
      } catch (err) {
        console.warn("AudioContext init error:", err)
      }

      // 3. Start native MediaRecorder for reliable server-side audio capture
      try {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
          const mime = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
            ? "audio/ogg;codecs=opus"
            : ""
          const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)

          audioChunksRef.current = []
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              audioChunksRef.current.push(e.data)
            }
          }

          recorder.onstop = async () => {
            if (audioChunksRef.current.length > 0) {
              const fullBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" })
              audioChunksRef.current = []
              if (webSpeechDisabledRef.current || !finalRef.current) {
                await transcribeAudioBlob(fullBlob)
              }
            }
          }

          mediaRecorderRef.current = recorder
          recorder.start(1000)
        }
      } catch (err) {
        console.warn("MediaRecorder start error:", err)
      }

      // 4. Start VAD 5-Second Silence Detection Loop
      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current)
      vadIntervalRef.current = setInterval(async () => {
        if (!activeRef.current || isAutoFlushingRef.current) return
        const analyser = analyserRef.current
        if (!analyser) return

        const buffer = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(buffer)
        let sum = 0
        for (let i = 0; i < buffer.length; i++) sum += buffer[i]
        const volume = sum / buffer.length

        // Volume above 10 indicates human voice speech
        if (volume > 10) {
          hasSpokenRef.current = true
          lastSpeechTimeRef.current = Date.now()
          setSilenceSeconds(0)
        } else if (hasSpokenRef.current) {
          const elapsedSilenceMs = Date.now() - lastSpeechTimeRef.current
          const elapsedSec = Math.floor(elapsedSilenceMs / 1000)
          setSilenceSeconds(elapsedSec)

          // 5-second silence pause reached after speaking: auto-transcribe immediately!
          if (elapsedSilenceMs >= 5000) {
            hasSpokenRef.current = false
            setSilenceSeconds(0)
            isAutoFlushingRef.current = true

            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
              mediaRecorderRef.current.requestData()
              setTimeout(async () => {
                if (audioChunksRef.current.length > 0) {
                  const blobToTranscribe = new Blob(audioChunksRef.current, {
                    type: mediaRecorderRef.current?.mimeType || "audio/webm",
                  })
                  audioChunksRef.current = []
                  await transcribeAudioBlob(blobToTranscribe)
                }
                isAutoFlushingRef.current = false
              }, 120)
            } else {
              isAutoFlushingRef.current = false
            }
          }
        }
      }, 100)
    }

    // 5. Start Web Speech only if healthy and not disabled
    if (!webSpeechDisabledRef.current && recognitionRef.current) {
      try {
        recognitionRef.current.start()
      } catch {}
    }
  }, [getAudioStream, transcribeAudioBlob])

  const stop = useCallback(() => {
    activeRef.current = false
    setListening(false)
    hasSpokenRef.current = false
    setSilenceSeconds(0)

    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current)
      vadIntervalRef.current = null
    }

    // Flush recorder and transcribe
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop()
      } catch {}
    }

    // Software-mute audio tracks instead of destroying hardware stream (prevents OS notification spam)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false))
    }

    // Stop Web Speech API if active
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
    }
  }, [])

  const reset = useCallback(() => {
    finalRef.current = ""
    hasSpokenRef.current = false
    setSilenceSeconds(0)
    setTranscript("")
    setInterim("")
    audioChunksRef.current = []
  }, [])

  return { supported, listening, transcript, interim, isTranscribing, silenceSeconds, start, stop, reset }
}
