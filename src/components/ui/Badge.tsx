import React from 'react'
import { Icon } from './Icon'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'
  size?: 'sm' | 'md' | 'lg'
  dot?: boolean
  icon?: string
  removable?: boolean
  onRemove?: () => void
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      children,
      variant = 'default',
      size = 'md',
      dot,
      icon,
      removable,
      onRemove,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const variantStyles: Record<string, React.CSSProperties> = {
      default: {
        background: 'var(--panel-2)',
        color: 'var(--text)',
        border: '1px solid var(--border)',
      },
      success: {
        background: 'var(--success-bg)',
        color: 'var(--ok)',
        border: '1px solid var(--success-border)',
      },
      warning: {
        background: 'var(--warning-bg)',
        color: 'var(--warn)',
        border: '1px solid var(--warning-border)',
      },
      danger: {
        background: 'var(--danger-bg)',
        color: 'var(--danger)',
        border: '1px solid var(--danger-border)',
      },
      info: {
        background: 'var(--info-bg)',
        color: 'var(--info)',
        border: '1px solid var(--info-border)',
      },
      primary: {
        background: 'var(--primary-bg)',
        color: 'var(--primary)',
        border: '1px solid var(--primary-border)',
      },
    }

    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: { padding: '2px 8px', fontSize: 11, borderRadius: 999, gap: 4 },
      md: { padding: '4px 10px', fontSize: 12, borderRadius: 999, gap: 5 },
      lg: { padding: '6px 14px', fontSize: 13, borderRadius: 999, gap: 6 },
    }

    const combinedStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      fontWeight: 600,
      letterSpacing: '0.02em',
      ...variantStyles[variant],
      ...sizeStyles[size],
      ...style,
    }

    return (
      <span ref={ref} className={className} style={combinedStyle} {...props}>
        {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
        {icon && <Icon name={icon as any} size={size === 'sm' ? 10 : size === 'lg' ? 14 : 12} />}
        {children}
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: size === 'sm' ? 16 : size === 'lg' ? 22 : 18,
              height: size === 'sm' ? 16 : size === 'lg' ? 22 : 18,
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              color: 'currentColor',
              opacity: 0.6,
              cursor: 'pointer',
              marginLeft: 4,
              padding: 0,
              transition: 'opacity 150ms ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseOut={(e) => (e.currentTarget.style.opacity = '0.6')}
          >
            <Icon name="x" size={size === 'sm' ? 8 : size === 'lg' ? 12 : 10} strokeWidth={2.5} />
          </button>
        )}
      </span>
    )
  }
)

Badge.displayName = 'Badge'
export default Badge