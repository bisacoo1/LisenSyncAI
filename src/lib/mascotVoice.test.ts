import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeTextForSpeech,
  prefetchMascotSpeech,
  readQuestionAloud,
  stopMascotVoice,
  warmupMascotVoice,
} from './mascotVoice'

type WorkerReply = {
  id: number
  buffer?: ArrayBuffer
  error?: string
}

class MockWorker {
  static requests: Array<{ id: number; text: string }> = []
  static nextError: string | undefined

  onmessage: ((event: MessageEvent<WorkerReply>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null

  postMessage(request: { id: number; text: string }) {
    MockWorker.requests.push(request)
    const error = MockWorker.nextError
    MockWorker.nextError = undefined
    const reply: WorkerReply = error
      ? { id: request.id, error }
      : { id: request.id, buffer: Uint8Array.from([1, 2, 3, 4]).buffer }
    queueMicrotask(() => this.onmessage?.({ data: reply } as MessageEvent<WorkerReply>))
  }

  terminate() {}
}

afterEach(() => {
  stopMascotVoice()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  MockWorker.requests.length = 0
  MockWorker.nextError = undefined
  vi.stubGlobal('Worker', MockWorker)
})

describe('mascot voice playback', () => {
  it('converts Roman numerals I through X after whole-word medical labels', () => {
    expect(normalizeTextForSpeech(
      'Class I, Type II, Phase III, Stage IV, Grade V, Generation VI, Factor VII, Schedule VIII, Cranial Nerve IX, Receptor X; Chapter II, active, toxicity.',
    )).toBe(
      'Class 1, Type 2, Phase 3, Stage 4, Grade 5, Generation 6, Factor 7, Schedule 8, Cranial Nerve 9, Receptor 10; Chapter II, active, toxicity.',
    )
  })

  it('expands common clinical comparison and dose symbols', () => {
    expect(normalizeTextForSpeech(
      'Na < 5 mg; dose > 10 mg; ± 2 µg and 3 mcg.',
    )).toBe(
      'Na less than 5 mg; dose greater than 10 mg; plus or minus 2 micrograms and 3 micrograms.',
    )
  })

  it('normalizes speech text before sending it to the Piper worker', async () => {
    MockWorker.nextError = 'Stop after capturing the request.'
    await expect(readQuestionAloud('Cranial Nerve V < 10 µg'))
      .rejects.toThrow('Stop after capturing the request.')

    expect(MockWorker.requests[0].text).toBe('Cranial Nerve 5 less than 10 micrograms')
  })

  it('surfaces worker errors without using browser speech synthesis', async () => {
    MockWorker.nextError = 'Piper initialization failed.'
    const speak = vi.fn()
    vi.stubGlobal('window', {
      speechSynthesis: {
        getVoices: () => [],
        speak,
        cancel: vi.fn(),
      },
    })
    vi.stubGlobal('SpeechSynthesisUtterance', class {})
    const onEnd = vi.fn()
    const onLoadingChange = vi.fn()

    await expect(readQuestionAloud('Hello, Lilo.', onEnd, onLoadingChange))
      .rejects.toThrow('Piper initialization failed.')

    expect(onLoadingChange.mock.calls).toEqual([[true], [false]])
    expect(onEnd).toHaveBeenCalledOnce()
    expect(speak).not.toHaveBeenCalled()
  })

  it('queues the next question until the current audio ends', async () => {
    const audioInstances: Array<{
      onended: (() => void) | null
      onerror: (() => void) | null
      playbackRate: number
      preservesPitch: boolean
    }> = []
    class MockAudio {
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      playbackRate = 1
      preservesPitch = false

      constructor() {
        audioInstances.push(this)
      }

      play() {
        return Promise.resolve()
      }

      pause() {}
      removeAttribute() {}
      load() {}
    }
    const createObjectURL = vi.spyOn(URL, 'createObjectURL')
    vi.stubGlobal('Audio', MockAudio)

    const first = readQuestionAloud('The answer is correct because...')
    await vi.waitFor(() => expect(audioInstances).toHaveLength(1))
    const second = readQuestionAloud('Next question.')

    expect(MockWorker.requests).toHaveLength(1)
    expect(audioInstances[0].playbackRate).toBe(1.11)
    expect(audioInstances[0].preservesPitch).toBe(true)
    expect(createObjectURL.mock.calls[0][0]).toMatchObject({ type: 'audio/wav' })
    audioInstances[0].onended?.()
    await vi.waitFor(() => expect(audioInstances).toHaveLength(2))
    expect(MockWorker.requests).toHaveLength(2)
    audioInstances[1].onended?.()
    await Promise.all([first, second])
  })

  it('reuses prefetched audio under the normalized speech text', async () => {
    const audioInstances: Array<{ onended: (() => void) | null }> = []
    class MockAudio {
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      playbackRate = 1

      constructor() {
        audioInstances.push(this)
      }

      play() {
        return Promise.resolve()
      }

      pause() {}
      removeAttribute() {}
      load() {}
    }
    vi.stubGlobal('Audio', MockAudio)

    prefetchMascotSpeech('Class V')
    await vi.waitFor(() => expect(MockWorker.requests).toHaveLength(1))
    const playback = readQuestionAloud('Class V')
    await vi.waitFor(() => expect(audioInstances).toHaveLength(1))

    expect(MockWorker.requests).toHaveLength(1)
    expect(MockWorker.requests[0].text).toBe('Class 5')
    audioInstances[0].onended?.()
    await playback
  })

  it('prewarms Piper once with a short clip and caches it by text', async () => {
    warmupMascotVoice()
    warmupMascotVoice()
    prefetchMascotSpeech('Hi')

    await vi.waitFor(() => expect(MockWorker.requests).toHaveLength(1))
    expect(MockWorker.requests[0].text).toBe('Hi')
  })
})
