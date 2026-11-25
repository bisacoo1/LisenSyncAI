type LoadingChange = (loading: boolean) => void

const ROMAN_TO_ARABIC: Record<string, string> = {
  I: '1',
  II: '2',
  III: '3',
  IV: '4',
  V: '5',
  VI: '6',
  VII: '7',
  VIII: '8',
  IX: '9',
  X: '10',
}

const MAX_CACHED_AUDIO = 24
const audioCache = new Map<string, Blob>()
const pendingAudio = new Map<string, Promise<Blob>>()
const pendingWorkerRequests = new Map<number, {
  resolve: (audio: Blob) => void
  reject: (error: Error) => void
}>()
let nextWorkerRequestId = 0
let piperWorker: Worker | null = null
let playbackVersion = 0
let activeAudio: HTMLAudioElement | null = null
let activeObjectUrl: string | null = null
let activeAudioResolve: (() => void) | null = null
let activeOnEnd: (() => void) | null = null
let activeLoadingChange: LoadingChange | null = null
let playbackQueue: Promise<void> = Promise.resolve()
let queueGeneration = 0

type PiperWorkerResponse = {
  id: number
  buffer?: ArrayBuffer
  error?: string
}

export function normalizeTextForSpeech(text: string): string {
  return text
    .replace(
      /\b(Cranial\s+Nerve|Phase|Type|Class|Stage|Grade|Generation|Factor|Schedule|Receptor)\s+(VIII|VII|VI|IV|III|II|IX|X|V|I)\b/gi,
      (_match, term: string, numeral: string) => `${term} ${ROMAN_TO_ARABIC[numeral.toUpperCase()]}`,
    )
    .replace(/</g, ' less than ')
    .replace(/>/g, ' greater than ')
    .replace(/±/g, ' plus or minus ')
    .replace(/(?:µg|mcg)/gi, ' micrograms ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function rejectPendingWorkerRequests(error: Error) {
  for (const pending of pendingWorkerRequests.values()) pending.reject(error)
  pendingWorkerRequests.clear()
}

function discardWorker(worker: Worker, error: Error) {
  worker.terminate()
  if (piperWorker === worker) piperWorker = null
  rejectPendingWorkerRequests(error)
}

function getPiperWorker(): Worker {
  if (piperWorker) return piperWorker

  const worker = new Worker(new URL("../workers/piperWorker.ts", import.meta.url), { type: "module" })
  worker.onmessage = event => {
    const response = event.data as PiperWorkerResponse
    const pending = pendingWorkerRequests.get(response.id)
    if (!pending) return
    pendingWorkerRequests.delete(response.id)

    if (response.error) {
      pending.reject(new Error(response.error))
    } else if (!response.buffer || response.buffer.byteLength === 0) {
      pending.reject(new Error("Piper worker returned an empty audio buffer."))
    } else {
      pending.resolve(new Blob([response.buffer], { type: "audio/wav" }))
    }
  }
  worker.onerror = event => {
    event.preventDefault()
    discardWorker(worker, new Error(event.message || "Piper speech worker failed."))
  }
  worker.onmessageerror = () => {
    discardWorker(worker, new Error("Piper speech worker returned an unreadable message."))
  }
  piperWorker = worker
  return worker
}

function generateSpeechAudio(text: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = getPiperWorker()
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)))
      return
    }

    const id = ++nextWorkerRequestId
    pendingWorkerRequests.set(id, { resolve, reject })
    try {
      worker.postMessage({ id, text })
    } catch (error) {
      pendingWorkerRequests.delete(id)
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

function loadSpeechAudio(text: string): Promise<Blob> {
  const key = text
  const cachedAudio = audioCache.get(key)
  if (cachedAudio) {
    audioCache.delete(key)
    audioCache.set(key, cachedAudio)
    return Promise.resolve(cachedAudio)
  }
  const pendingRequest = pendingAudio.get(key)
  if (pendingRequest) return pendingRequest

  const request = generateSpeechAudio(text).then(audio => {
    audioCache.delete(key)
    audioCache.set(key, audio)
    if (audioCache.size > MAX_CACHED_AUDIO) {
      const oldestKey = audioCache.keys().next().value
      if (oldestKey) audioCache.delete(oldestKey)
    }
    return audio
  }).finally(() => {
    pendingAudio.delete(key)
  })

  pendingAudio.set(key, request)
  return request
}

export function prefetchMascotSpeech(text: string): void {
  const cleanText = normalizeTextForSpeech(text)
  if (!cleanText) return
  void loadSpeechAudio(cleanText).catch(error => {
    console.error("Mascot speech prefetch failed:", error)
  })
}

export function warmupMascotVoice(): void {
  prefetchMascotSpeech('Hi')
}

function releaseAudio() {
  if (activeAudio) {
    activeAudio.onended = null
    activeAudio.onerror = null
    activeAudio.pause()
    activeAudio.removeAttribute("src")
    activeAudio.load()
    activeAudio = null
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
}

function finishPlayback(version: number) {
  if (version !== playbackVersion) return
  releaseAudio()
  const resolveAudio = activeAudioResolve
  activeAudioResolve = null
  resolveAudio?.()
  const onEnd = activeOnEnd
  const onLoadingChange = activeLoadingChange
  activeOnEnd = null
  activeLoadingChange = null
  onLoadingChange?.(false)
  onEnd?.()
}

export function stopMascotVoice() {
  queueGeneration += 1
  playbackVersion += 1
  releaseAudio()
  const resolveAudio = activeAudioResolve
  activeAudioResolve = null
  resolveAudio?.()
  const onEnd = activeOnEnd
  const onLoadingChange = activeLoadingChange
  activeOnEnd = null
  activeLoadingChange = null
  onLoadingChange?.(false)
  onEnd?.()
}

async function playQuestionAloud(
  text: string,
  onEnd: () => void = () => {},
  onLoadingChange?: LoadingChange,
  onStart?: () => void,
): Promise<void> {
  const version = ++playbackVersion
  const cleanText = normalizeTextForSpeech(text)
  if (!cleanText) {
    onEnd()
    return
  }

  activeOnEnd = onEnd
  activeLoadingChange = onLoadingChange ?? null
  try {
    onLoadingChange?.(true)
    const audioBlob = await loadSpeechAudio(cleanText)
    if (version !== playbackVersion) return
    activeObjectUrl = URL.createObjectURL(audioBlob)
    const audioElement = new Audio(activeObjectUrl)
    activeAudio = audioElement
    await new Promise<void>((resolve, reject) => {
      activeAudioResolve = resolve
      audioElement.playbackRate = 1.11
      audioElement.preservesPitch = true
      const fail = (error: unknown) => {
        if (version !== playbackVersion) {
          resolve()
          return
        }
        if (activeAudioResolve !== resolve) return
        activeAudioResolve = null
        audioElement.onended = null
        audioElement.onerror = null
        reject(error instanceof Error ? error : new Error("Generated audio could not be played."))
      }

      audioElement.onended = () => finishPlayback(version)
      audioElement.onerror = () => fail(new Error("Generated audio could not be played."))
      void audioElement.play().then(() => {
        if (version !== playbackVersion) return
        onLoadingChange?.(false)
        activeLoadingChange = null
        onStart?.()
      }).catch(error => {
        console.error("Audio play blocked:", error)
        fail(error)
      })
    })
    if (version !== playbackVersion) return
  } catch (error) {
    if (version !== playbackVersion) return
    if (activeAudio) {
      activeAudio.onended = null
      activeAudio.onerror = null
    }
    releaseAudio()
    finishPlayback(version)
    throw error
  } finally {
    if (version === playbackVersion) {
      if (activeLoadingChange === onLoadingChange) {
        activeLoadingChange = null
        onLoadingChange?.(false)
      }
    }
  }
}

export function readQuestionAloud(
  text: string,
  onEnd: () => void = () => {},
  onLoadingChange?: LoadingChange,
  onStart?: () => void,
): Promise<void> {
  const generation = queueGeneration
  const playback = playbackQueue.catch(() => {}).then(() => {
    if (generation !== queueGeneration) return
    return playQuestionAloud(text, onEnd, onLoadingChange, onStart)
  })
  playbackQueue = playback
  return playback
}
