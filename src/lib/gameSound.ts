/**
 * Sound effects for Lilo's Rx Runner (Game Mode).
 *
 * Every effect is synthesized with the Web Audio API, so there are no external
 * audio files to ship and the bundle stays small. The audio context is only
 * started after a user gesture (tapping "Start run"), which is what browsers
 * require before audio can play. Sound on/off state is persisted in
 * localStorage so it survives reloads.
 */

const STORAGE_KEY = 'pharmora:game:sound'

class GameSound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  private enabled: boolean
  private readonly volume = 0.5

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY)
    this.enabled = stored === null || stored === '1'
  }

  get isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(next: boolean): void {
    this.enabled = next
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // localStorage may be unavailable in private browsing
    }
    if (next) {
      this.boot().catch(() => {
        // Audio may remain blocked until the next user gesture.
      })
    }
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled)
    return this.enabled
  }

  async boot(): Promise<boolean> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      return true
    }

    const Ctor =
      window.AudioContext ??
      ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null)
    if (!Ctor) return false

    this.ctx = new Ctor()
    this.master = this.ctx.createGain()
    this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime)
    this.master.connect(this.ctx.destination)
    this.makeNoiseBuffer()

    if (this.ctx.state === 'suspended') await this.ctx.resume()
    return true
  }

  /** Schedules one tone relative to the audio clock "now". */
  private tone(
    type: OscillatorType,
    frequency: number | number[],
    delay: number,
    duration: number,
    gainVol: number,
  ): void {
    if (!this.enabled || !this.ctx || !this.master) return
    const { ctx } = this
    const start = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(this.master)

    osc.type = type
    if (Array.isArray(frequency)) {
      osc.frequency.setValueAtTime(frequency[0], start)
      const step = duration / frequency.length
      for (let i = 1; i < frequency.length; i++) {
        osc.frequency.linearRampToValueAtTime(frequency[i], start + step * i)
      }
    } else {
      osc.frequency.setValueAtTime(frequency, start)
    }

    gain.gain.setValueAtTime(gainVol, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)

    osc.start(start)
    osc.stop(start + duration + 0.05)
  }

  /** Schedules a burst of white noise relative to the audio clock "now". */
  private noise(delay: number, duration: number, gainVol: number): void {
    if (!this.enabled || !this.ctx || !this.master || !this.noiseBuffer) return
    const { ctx } = this
    const start = ctx.currentTime + delay
    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    const gain = ctx.createGain()
    source.connect(gain)
    gain.connect(this.master)
    gain.gain.setValueAtTime(gainVol, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    source.start(start)
    source.stop(start + duration)
  }

  private makeNoiseBuffer(): void {
    if (!this.ctx) return
    const { ctx } = this
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    this.noiseBuffer = buffer
  }

  /* ---------------------------------------------------------------- effects */

  playStart(): void {
    // Fanfare when the run begins.
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, index) => this.tone('square', freq, index * 0.11, 0.18, 0.28))
  }

  playJump(): void {
    this.tone('square', [240, 480], 0, 0.13, 0.26)
  }

  playSlide(): void {
    this.tone('sawtooth', [320, 110], 0, 0.18, 0.26)
  }

  playDodge(): void {
    this.tone('square', [850, 1400], 0, 0.08, 0.26)
  }

  playHit(): void {
    this.tone('square', [120, 70], 0, 0.45, 0.3)
    this.noise(0, 0.22, 0.28)
  }

  playCollectCapsule(): void {
    this.tone('sine', [950, 1080], 0, 0.11, 0.2)
  }

  playCollectGold(): void {
    this.tone('triangle', [720, 1080, 1440], 0, 0.3, 0.24)
  }

  playCheckpointCorrect(): void {
    this.tone('square', [523.25, 659.25, 783.99, 1046.5], 0, 0.5, 0.26)
  }

  playCheckpointWrong(): void {
    this.tone('sawtooth', [240, 150], 0, 0.5, 0.3)
  }

  playGameOver(): void {
    this.tone('sawtooth', [420, 90], 0, 1.7, 0.26)
  }
}

export const gameSound = new GameSound()
