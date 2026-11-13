import React from 'react'
import { Icon } from './Icon'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | 'filled'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = 'default', padding = 'md', hoverable, className = '', style, ...props }, ref) => {
    const variantStyles: Record<string, React.CSSProperties> = {
      default: {
        background: 'var(--panel)',
        border: '1px solid var(--border)',
      },
      elevated: {
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.1)',
      },
      outlined: {
        background: 'transparent',
        border: '1px solid var(--border)',
      },
      filled: {
        background: 'var(--panel-2)',
        border: '1px solid var(--border)',
      },
    }

    const paddingStyles: Record<string, React.CSSProperties> = {
      none: { padding: 0 },
      sm: { padding: 12 },
      md: { padding: 16 },
      lg: { padding: 24 },
    }

    const combinedStyle: React.CSSProperties = {
      borderRadius: 12,
      ...variantStyles[variant],
      ...paddingStyles[padding],
      transition: 'all 200ms ease',
      cursor: hoverable ? 'pointer' : undefined,
      ...style,
    }

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
      if (hoverable) {
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15)'
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = 'var(--primary)'
      }
      props.onMouseEnter?.(e)
    }

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (hoverable) {
        e.currentTarget.style.boxShadow = variantStyles[variant].boxShadow || 'none'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }
      props.onMouseLeave?.(e)
    }

    return (
      <div
        ref={ref}
        className={className}
        style={combinedStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  icon?: string
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, subtitle, action, icon, children, className = '', style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)',
          ...style,
        }}
        {...props}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {icon && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name={icon as any} size={20} style={{ color: 'var(--primary)' }} />
            </div>
          )}
          {title && (
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </h3>
          )}
          {subtitle && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>{subtitle}</p>
          )}
          {children}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
    )
  }
)

CardHeader.displayName = 'CardHeader'

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className = '', style, ...props }, ref) => {
    return (
      <div ref={ref} className={className} style={{ ...style }} {...props}>
        {children}
      </div>
    )
  }
)

CardContent.displayName = 'CardContent'

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = '', style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--border)',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    )
  }
)

CardFooter.displayName = 'CardFooter'

export default Card