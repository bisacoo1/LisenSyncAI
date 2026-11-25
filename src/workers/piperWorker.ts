import * as ort from 'onnxruntime-web'
import { TtsSession } from '@mintplex-labs/piper-tts-web'

ort.env.wasm.wasmPaths = '/onnx/'

// Force single-threaded inference. TtsSession resets numThreads from
// navigator.hardwareConcurrency during its own initialization, so we also pin that to 1.
// Multi-threaded mode (SharedArrayBuffer + cross-origin isolation) was attempted but
// caused uncaught errors inside ONNX Runtime's internal worker, so it stays disabled
// until a guarded fallback can be validated. The lighter "low" voice plus the prefetch
// in PracticePage already remove the perceived wait for cached / sequential speech.
ort.env.wasm.numThreads = 1
Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 1 })

// Piper voice used for Lilo. Pinned to a "low" model to cut first-sound latency:
// a smaller download (~10 MB vs ~40 MB) and lighter inference than the previous
// "medium" model, so cached audio is usually ready before Lilo needs to speak.
// Other fast English(US) voices in the @mintplex-labs/piper-tts-web catalog:
//   en_US-amy-low, en_US-danny-low, en_US-kathleen-low, en_US-lessac-low, en_US-ryan-low
const MASCOT_VOICE_ID = 'en_US-ryan-low'

type PiperRequest = {
  id: number
  text: string
}

let sessionPromise: Promise<TtsSession> | undefined

function getSession(): Promise<TtsSession> {
  if (!sessionPromise) {
    sessionPromise = TtsSession.create({
      voiceId: MASCOT_VOICE_ID,
      wasmPaths: { ...TtsSession.WASM_LOCATIONS, onnxWasm: '/onnx/' },
    }).catch(error => {
      sessionPromise = undefined
      throw error
    })
  }
  return sessionPromise
}

self.onmessage = async (event: MessageEvent<PiperRequest>) => {
  const { id, text } = event.data
  try {
    const session = await getSession()
    const wavBlob = await session.predict(text)
    const buffer = await wavBlob.arrayBuffer()
    self.postMessage({ id, buffer }, { transfer: [buffer] })
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
