import React from 'react'
import { useAnimatedValue } from '@/hooks/useAnimatedValue'

export interface ProgressBarProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'primary'
  showLabel?: boolean
  label?: string
  ariaLabel?: string
  animated?: boolean
  striped?: boolean
  className?: string
  style?: React.CSSProperties
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  label,
  ariaLabel,
  animated = false,
  striped = false,
  className = '',
  style,
}) => {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100))
  const { value: displayPercentage, ref } = useAnimatedValue<HTMLDivElement>(percentage, {
    duration: 900,
    startOnView: true,
  })

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { height: 4, borderRadius: 999, fontSize: 10 },
    md: { height: 8, borderRadius: 999, fontSize: 11 },
    lg: { height: 12, borderRadius: 999, fontSize: 12 },
  }

  const variantColors: Record<string, string> = {
    default: 'var(--primary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
    primary: 'var(--primary)',
  }

  const trackStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--panel-2)',
    borderRadius: 999,
    overflow: 'hidden',
    ...sizeStyles[size],
    boxShadow: 'none',
  }

  const fillStyle: React.CSSProperties = {
    width: `${displayPercentage}%`,
    height: '100%',
    background: variantColors[variant],
    borderRadius: 999,
    position: 'relative',
    overflow: 'hidden',
  }

  const stripeStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
    backgroundSize: '20px 20px',
    animation: animated ? 'stripe 1s linear infinite' : 'none',
  }

  return (
    <div ref={ref} className={className} style={{ width: '100%', ...style }}>
      {(showLabel || label) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 6,
            fontSize: sizeStyles[size].fontSize,
            fontWeight: 600,
          }}
        >
          <span>{label || `${Math.round(percentage)}%`}</span>
          <span style={{ color: 'var(--muted)' }}>{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        style={trackStyle}
        role="progressbar"
        aria-label={ariaLabel || label || 'Progress'}
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`ui-progress-fill${animated ? ' ui-progress-fill--live' : ''}`} style={fillStyle}>
          {striped && <div style={stripeStyle} />}
        </div>
      </div>
    </div>
  )
}

export interface CircularProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  variant?: 'default' | 'success' | 'warning' | 'danger'
  showLabel?: boolean
  ariaLabel?: string
  className?: string
  style?: React.CSSProperties
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max = 100,
  size = 48,
  strokeWidth = 4,
  variant = 'default',
  showLabel = true,
  ariaLabel,
  className = '',
  style,
}) => {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100))
  const { value: displayPercentage, ref } = useAnimatedValue<HTMLDivElement>(percentage, {
    duration: 1000,
    startOnView: true,
  })
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (displayPercentage / 100) * circumference

  const variantColors: Record<string, string> = {
    default: 'var(--primary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
  }

  return (
    <div
      ref={ref}
      className={`ui-circular-progress ${className}`.trim()}
      style={{ width: size, height: size, position: 'relative', ...style }}
      role="progressbar"
      aria-label={ariaLabel || 'Progress'}
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--panel-2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={variantColors[variant]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {showLabel && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: size * 0.22,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text)',
            }}
          >
            {Math.round(displayPercentage)}%
          </div>
          <span className="sr-only">{Math.round(percentage)}%</span>
        </>
      )}
    </div>
  )
}

export default ProgressBar
