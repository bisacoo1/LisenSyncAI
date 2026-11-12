import React from 'react'
import { Icon } from './Icon'

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'white' | 'muted'
  className?: string
  style?: React.CSSProperties
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
  style,
}) => {
  const sizeMap = { sm: 20, md: 32, lg: 48, xl: 64 }
  const strokeWidthMap = { sm: 2.5, md: 3, lg: 3.5, xl: 4 }

  const colorMap = {
    primary: 'var(--primary)',
    white: '#fff',
    muted: 'var(--muted)',
  }

  const diameter = sizeMap[size]
  const strokeWidth = strokeWidthMap[size]
  const radius = (diameter - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: diameter,
        height: diameter,
        ...style,
      }}
      role="status"
      aria-label="Loading"
    >
      <svg width={diameter} height={diameter} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke={colorMap[color]}
          strokeWidth={strokeWidth}
          strokeOpacity={0.2}
        />
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke={colorMap[color]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.75}
          style={{
            animation: 'spin 1s linear infinite, dash 1.5s ease-in-out infinite',
            transformOrigin: 'center',
          }}
        />
      </svg>
    </div>
  )
}

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
  width?: string | number
  height?: string | number
  className?: string
  style?: React.CSSProperties
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width = '100%',
  height,
  className = '',
  style,
}) => {
  const baseStyle: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--panel-2) 25%, var(--border) 50%, var(--panel-2) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: variant === 'circular' ? '50%' : variant === 'text' ? 4 : 8,
    ...style,
  }

  const variantStyles: Record<string, React.CSSProperties> = {
    text: { height: height || 16, width: width, borderRadius: 4 },
    circular: { width: width || 40, height: height || 40, borderRadius: '50%' },
    rectangular: { width: width || '100%', height: height || 120, borderRadius: 8 },
    card: { width: width || '100%', height: height || 200, borderRadius: 12 },
  }

  return (
    <div className={className} style={{ ...baseStyle, ...variantStyles[variant] }} />
  )
}

export default Spinner