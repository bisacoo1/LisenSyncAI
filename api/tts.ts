import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts"

const DEFAULT_VOICE = "en-US-TonyNeural"
const OUTPUT_AUDIO_FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3

type TtsRequest = {
  method?: string
  body?: unknown
}

type TtsResponse = {
  headersSent: boolean
  status(code: number): TtsResponse
  setHeader(name: string, value: string): void
  end(body?: string | Uint8Array): void
}

type TtsBody = {
  text?: unknown
  voice?: unknown
  rate?: unknown
  pitch?: unknown
}

function sendError(response: TtsResponse, status: number, message: string) {
  response.status(status)
  response.setHeader("Content-Type", "application/json; charset=utf-8")
  response.end(JSON.stringify({ error: message }))
}

function escapeXmlText(text: string) {
  return text.replace(/[&<>]/g, character => {
    if (character === "&") return "&amp;"
    if (character === "<") return "&lt;"
    return "&gt;"
  })
}

export default async function handler(request: TtsRequest, response: TtsResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST")
    sendError(response, 405, "Method not allowed.")
    return
  }

  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
    sendError(response, 400, "A JSON request body is required.")
    return
  }

  const { text, voice = DEFAULT_VOICE, rate = "+8%", pitch = "+18%" } = request.body as TtsBody
  if (typeof text !== "string" || !text.trim()) {
    sendError(response, 400, "Text is required.")
    return
  }
  if (typeof voice !== "string" || !voice.trim() || typeof rate !== "string" || typeof pitch !== "string") {
    sendError(response, 400, "Voice, rate, and pitch must be strings.")
    return
  }

  const tts = new MsEdgeTTS()
  try {
    await tts.setMetadata(voice, OUTPUT_AUDIO_FORMAT)
    const { audioStream } = tts.toStream(escapeXmlText(text), { rate, pitch })
    const chunks: Uint8Array[] = []

    await new Promise<void>(resolve => {
      let completed = false
      const finish = () => {
        if (completed) return
        completed = true
        tts.close()
        resolve()
      }

      audioStream.on("data", (chunk: Uint8Array) => chunks.push(chunk))
      audioStream.once("error", (error: unknown) => {
        if (completed) return
        console.error("Mascot speech synthesis failed:", error)
        if (!response.headersSent) sendError(response, 500, "Speech synthesis failed.")
        else response.end()
        finish()
      })
      audioStream.once("end", () => {
        if (completed) return
        try {
          const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
          const audio = new Uint8Array(byteLength)
          let offset = 0
          for (const chunk of chunks) {
            audio.set(chunk, offset)
            offset += chunk.byteLength
          }
          response.setHeader("Content-Type", "audio/mpeg")
          response.setHeader("Content-Length", String(audio.byteLength))
          response.status(200).end(audio)
        } catch (error) {
          console.error("Could not buffer mascot speech audio:", error)
          if (!response.headersSent) sendError(response, 500, "Speech synthesis failed.")
          else response.end()
        }
        finish()
      })
    })
  } catch (error) {
    tts.close()
    console.error("Mascot speech synthesis failed:", error)
    sendError(response, 500, "Speech synthesis failed.")
  }
}
