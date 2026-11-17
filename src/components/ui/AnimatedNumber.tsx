import React from 'react'
import { useAnimatedValue } from '@/hooks/useAnimatedValue'

export interface AnimatedNumberProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Number to count up to. */
  value: number
  /** Decimal places to render. Defaults to 0 for integers, 1 for fractions. */
  decimals?: number
  /** Animation length in ms. Default 900. */
  duration?: number
  /** Delay before counting starts, in ms. */
  delay?: number
  /** Rendered before the digits, e.g. "$". */
  prefix?: string
  /** Rendered after the digits, e.g. "%" or " XP". */
  suffix?: string
  /** Insert locale thousands separators. Default true. */
  separator?: boolean
  /** Wait until the element scrolls into view before counting. */
  startOnView?: boolean
  /** Set false to render the final value instantly. */
  animate?: boolean
  /** Custom formatter for the displayed digits. */
  format?: (value: number) => string
  /** Screen-reader text; defaults to the final formatted value. */
  ariaLabel?: string
}

export function formatCount(value: number, decimals = 0, separator = true): string {
  const safe = Number.isFinite(value) ? value : 0
  const rounded = decimals > 0 ? safe : Math.round(safe)
  if (!separator) return rounded.toFixed(decimals)
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * The accessible text stays static (final value) while the visible digits
 * animate, so screen readers never announce every intermediate frame.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals,
  duration = 900,
  delay = 0,
  prefix = '',
  suffix = '',
  separator = true,
  startOnView = false,
  animate = true,
  format,
  ariaLabel,
  className = '',
  ...rest
}) => {
  const { value: display, ref } = useAnimatedValue(value, {
    duration,
    delay,
    startOnView,
    enabled: animate,
  })

  const resolvedDecimals = decimals ?? (Number.isInteger(value) ? 0 : 1)
  const render = (n: number) => (format ? format(n) : formatCount(n, resolvedDecimals, separator))
  const finalText = `${prefix}${render(value)}${suffix}`

  return (
    <span ref={ref} className={`animated-number ${className}`.trim()} {...rest}>
      <span aria-hidden="true">
        {prefix}
        {render(display)}
        {suffix}
      </span>
      <span className="sr-only">{ariaLabel || finalText}</span>
    </span>
  )
}

export default AnimatedNumber
