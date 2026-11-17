import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, useReducedMotion } from './useReducedMotion'

export interface UseAnimatedValueOptions {
  /** Animation length in ms. */
  duration?: number
  /** Delay before the animation starts, in ms. */
  delay?: number
  /** Only start once the element scrolls into view. */
  startOnView?: boolean
  /** Skip animation and jump straight to the target. */
  enabled?: boolean
}

export interface UseAnimatedValueResult<T extends HTMLElement = HTMLSpanElement> {
  /** The current (animating) value, safe to render. */
  value: number
  /** Attach to the element you want to observe when `startOnView` is used. */
  ref: React.RefObject<T>
}

/**
 * Tweens a number toward `target` with requestAnimationFrame + ease-out cubic.
 *
 * - Starts at 0 so stats visibly "count up" on first paint.
 * - Later target changes tween from the current value (no reset flash).
 * - Respects `prefers-reduced-motion` by jumping to the final value.
 */
export function useAnimatedValue<T extends HTMLElement = HTMLSpanElement>(
  target: number,
  { duration = 900, delay = 0, startOnView = false, enabled = true }: UseAnimatedValueOptions = {}
): UseAnimatedValueResult<T> {
  const reduced = useReducedMotion()
  const ref = useRef<T>(null)
  const safeTarget = Number.isFinite(target) ? target : 0
  const [value, setValue] = useState(() => (enabled && !prefersReducedMotion() ? 0 : safeTarget))
  const [inView, setInView] = useState(!startOnView)
  const currentRef = useRef(value)

  useEffect(() => {
    currentRef.current = value
  }, [value])

  useEffect(() => {
    if (!startOnView) {
      setInView(true)
      return
    }
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [startOnView])

  useEffect(() => {
    if (!enabled) return

    if (reduced) {
      currentRef.current = safeTarget
      setValue(safeTarget)
      return
    }

    if (!inView) return

    const from = currentRef.current
    if (Math.abs(from - safeTarget) < 0.001) return

    let frame = 0
    const startedAt = performance.now() + delay
    const step = (now: number) => {
      const elapsed = now - startedAt
      if (elapsed < 0) {
        frame = requestAnimationFrame(step)
        return
      }
      const progress = Math.min(1, elapsed / Math.max(1, duration))
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = from + (safeTarget - from) * eased
      currentRef.current = next
      setValue(next)
      if (progress < 1) {
        frame = requestAnimationFrame(step)
      } else {
        currentRef.current = safeTarget
        setValue(safeTarget)
      }
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [safeTarget, enabled, inView, reduced, duration, delay])

  return { value, ref }
}

export default useAnimatedValue
