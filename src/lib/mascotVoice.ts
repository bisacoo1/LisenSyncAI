type LoadingChange = (loading: boolean) => void

const DEFAULT_VOICE = "en-US-TonyNeural"
let playbackVersion = 0
let activeAudio: HTMLAudioElement | null = null
let activeObjectUrl: string | null = null
let activeAudioResolve: (() => void) | null = null
let activeOnEnd: (() => void) | null = null
let activeLoadingChange: LoadingChange | null = null
let stopFallbackSpeech: (() => void) | null = null

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
  stopFallbackSpeech = null
  const onEnd = activeOnEnd
  const onLoadingChange = activeLoadingChange
  activeOnEnd = null
  activeLoadingChange = null
  onLoadingChange?.(false)
  onEnd?.()
}

export function stopMascotVoice() {
  playbackVersion += 1
  releaseAudio()
  const resolveAudio = activeAudioResolve
  activeAudioResolve = null
  resolveAudio?.()
  const stopFallback = stopFallbackSpeech
  stopFallbackSpeech = null
  stopFallback?.()
  const onEnd = activeOnEnd
  const onLoadingChange = activeLoadingChange
  activeOnEnd = null
  activeLoadingChange = null
  onLoadingChange?.(false)
  onEnd?.()
}

export async function readQuestionAloud(
  text: string,
  voice: string = DEFAULT_VOICE,
  onEnd: () => void = () => {},
  onLoadingChange?: LoadingChange,
  onStart?: () => void,
): Promise<void> {
  stopMascotVoice()
  const version = ++playbackVersion
  const cleanText = text.trim()
  if (!cleanText) {
    onEnd()
    return
  }

  activeOnEnd = onEnd
  activeLoadingChange = onLoadingChange ?? null
  try {
    onLoadingChange?.(true)
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanText, voice }),
    })
    if (version !== playbackVersion) return
    if (!response.ok) throw new Error(`Speech service returned ${response.status}.`)
    const audioBlob = await response.blob()
    if (version !== playbackVersion) return
    if (audioBlob.size === 0) throw new Error("Speech service returned empty audio.")
    activeObjectUrl = URL.createObjectURL(audioBlob)
    const audioElement = new Audio(activeObjectUrl)
    activeAudio = audioElement
    await new Promise<void>((resolve, reject) => {
      activeAudioResolve = resolve
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
    onLoadingChange?.(false)
    activeLoadingChange = null
    if (activeAudio) {
      activeAudio.onended = null
      activeAudio.onerror = null
    }
    releaseAudio()

    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      finishPlayback(version)
      throw error
    }

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText)
      const synthesis = window.speechSynthesis
      const voices = synthesis.getVoices()
      const britishVoices = voices.filter(candidate => /^en-GB\b/i.test(candidate.lang))
      const fallbackVoice =
        britishVoices.find(candidate => /\b(ryan|george|daniel|oliver|arthur|thomas|male)\b/i.test(candidate.name)) ??
        britishVoices[0] ??
        voices.find(candidate => /\b(ryan|george|daniel|oliver|arthur|thomas|male)\b/i.test(candidate.name)) ??
        voices.find(candidate => /^en-/i.test(candidate.lang))
      if (fallbackVoice) {
        utterance.voice = fallbackVoice
        utterance.lang = fallbackVoice.lang
      } else {
        utterance.lang = "en-GB"
      }
      utterance.rate = 0.86
      utterance.pitch = 1
      utterance.onstart = () => {
        if (version !== playbackVersion) return
        onLoadingChange?.(false)
        activeLoadingChange = null
        onStart?.()
      }
      utterance.onend = () => finishPlayback(version)
      utterance.onerror = () => finishPlayback(version)
      stopFallbackSpeech = () => synthesis.cancel()
      synthesis.speak(utterance)
    } catch (fallbackError) {
      finishPlayback(version)
      throw fallbackError
    }
  }
}
