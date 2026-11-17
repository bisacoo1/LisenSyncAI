import React, { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

type RevealTag = 'div' | 'section' | 'article' | 'header' | 'footer' | 'li' | 'ul' | 'ol' | 'span'

export interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  /** Element to render. Defaults to a div. */
  as?: RevealTag
  /** Stagger delay in ms. */
  delay?: number
  /** Vertical travel distance in px. Default 16. */
  distance?: number
  /** Animate only the first time it enters the viewport. Default true. */
  once?: boolean
}

/**
 * Fade + rise reveal on scroll. Progressive enhancement only:
 * with reduced motion (or no IntersectionObserver) the content is shown instantly.
 */
export const Reveal: React.FC<RevealProps> = ({
  as = 'div',
  delay = 0,
  distance,
  once = true,
  className = '',
  style,
  children,
  ...rest
}) => {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) {
      setVisible(true)
      return
    }
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting) {
          setVisible(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setVisible(false)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [reduced, once])

  const Tag = as as React.ElementType
  const revealStyle = {
    ...style,
    ['--reveal-delay' as string]: `${delay}ms`,
    ...(distance != null ? { ['--reveal-distance' as string]: `${distance}px` } : null),
  } as React.CSSProperties

  return (
    <Tag
      ref={ref}
      className={`reveal${visible ? ' is-visible' : ''} ${className}`.trim()}
      style={revealStyle}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export default Reveal
