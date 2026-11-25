import * as ort from 'onnxruntime-web'
import { TtsSession } from '@mintplex-labs/piper-tts-web'

ort.env.wasm.wasmPaths = '/onnx/'
ort.env.wasm.numThreads = 1
// TtsSession resets numThreads from navigator.hardwareConcurrency during initialization.
Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 1 })

type PiperRequest = {
  id: number
  text: string
}

let sessionPromise: Promise<TtsSession> | undefined

function getSession(): Promise<TtsSession> {
  if (!sessionPromise) {
    sessionPromise = TtsSession.create({
      voiceId: 'en_US-bryce-medium',
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
