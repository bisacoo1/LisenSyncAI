import * as ort from 'onnxruntime-web'
import { TtsSession } from '@mintplex-labs/piper-tts-web'

ort.env.wasm.wasmPaths = '/onnx/'

// Multi-threaded inference needs SharedArrayBuffer, which browsers only expose on a
// cross-origin isolated page (COOP: same-origin + COEP, set in vercel.json and the Vite
// dev/preview server). When that isolation is present we use several threads so speech
// synthesizes faster; otherwise we fall back to a single thread (same as before). The
// count is clamped so small models don't pay pthread spawn overhead.
const MASCOT_THREADS = (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated)
  ? Math.min(navigator.hardwareConcurrency || 4, 4)
  : 1
ort.env.wasm.numThreads = MASCOT_THREADS
// TtsSession resets numThreads from navigator.hardwareConcurrency during initialization,
// so mirror the chosen count there too (this is the worker-scoped navigator only).
Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: MASCOT_THREADS })

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
