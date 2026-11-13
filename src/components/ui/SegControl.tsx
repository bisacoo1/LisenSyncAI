import React from 'react'
import { Icon } from './Icon'

export interface SegControlOption {
  value: string
  label: string
  icon?: string
  disabled?: boolean
}

export interface SegControlProps {
  options: SegControlOption[]
  value: string
  onChange: (value: string) => void
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  className?: string
  style?: React.CSSProperties
}

export const SegControl: React.FC<SegControlProps> = ({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth,
  className = '',
  style,
}) => {
  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '4px 10px', fontSize: 12, gap: 4, borderRadius: 8 },
    md: { padding: '8px 16px', fontSize: 13, gap: 6, borderRadius: 10 },
    lg: { padding: '12px 20px', fontSize: 14, gap: 8, borderRadius: 10 },
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--panel-2)',
    border: '1px solid var(--border)',
    borderRadius: size === 'sm' ? 8 : 10,
    padding: 4,
    width: fullWidth ? '100%' : 'auto',
    ...style,
  }

  const optionStyle = (opt: SegControlOption, isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizeStyles[size].gap,
    padding: sizeStyles[size].padding,
    fontSize: sizeStyles[size].fontSize,
    fontWeight: 600,
    fontFamily: 'inherit',
    color: isActive ? 'var(--on-primary)' : 'var(--muted)',
    background: isActive ? 'var(--primary)' : 'transparent',
    border: 'none',
    borderRadius: size === 'sm' ? 6 : 8,
    cursor: opt.disabled ? 'not-allowed' : 'pointer',
    transition: 'all 150ms ease',
    opacity: opt.disabled ? 0.5 : 1,
    whiteSpace: 'nowrap',
    ...sizeStyles[size],
  })

  return (
    <div className={className} style={containerStyle} role="group" aria-label="Segmented control">
      {options.map((opt, idx) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={opt.value === value}
          aria-disabled={opt.disabled}
          disabled={opt.disabled}
          onClick={() => !opt.disabled && onChange(opt.value)}
          style={optionStyle(opt, opt.value === value)}
        >
          {opt.icon && <Icon name={opt.icon as any} size={size === 'sm' ? 12 : size === 'lg' ? 18 : 16} />}
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default SegControl