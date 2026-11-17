import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** Synchronous read, safe during render (returns false outside the browser). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(QUERY).matches
}

/**
 * Tracks the user's "reduce motion" OS setting so motion-heavy components can
 * render their final state immediately instead of animating.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(prefersReducedMotion)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    const onChange = () => setReduced(mq.matches)
    onChange()
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    // Safari < 14 fallback
    mq.addListener(onChange)
    return () => mq.removeListener(onChange)
  }, [])

  return reduced
}

export default useReducedMotion
