import React from 'react'
import { Icon } from './Icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  leftIcon?: string
  rightIcon?: string
  loading?: boolean
  fullWidth?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      leftIcon,
      rightIcon,
      loading,
      fullWidth,
      className = '',
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    const baseStyles: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      fontWeight: 600,
      borderRadius: 10,
      border: 'none',
      cursor: 'pointer',
      transition: 'all 150ms ease',
      whiteSpace: 'nowrap',
      fontFamily: 'inherit',
      width: fullWidth ? '100%' : 'auto',
      opacity: disabled || loading ? 0.6 : 1,
      pointerEvents: disabled || loading ? 'none' : 'auto',
    }

    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: { padding: '6px 12px', fontSize: 13, gap: 6 },
      md: { padding: '10px 16px', fontSize: 14, gap: 8 },
      lg: { padding: '14px 24px', fontSize: 15, gap: 8 },
      icon: { padding: '10px', fontSize: 0, width: 40, height: 40 },
    }

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%)',
        color: '#041014',
        boxShadow: '0 2px 8px rgba(45, 212, 191, 0.3)',
      },
      secondary: {
        background: 'var(--panel-2)',
        color: 'var(--text)',
        border: '1px solid var(--border)',
      },
      outline: {
        background: 'transparent',
        color: 'var(--primary)',
        border: '1px solid var(--primary)',
      },
      ghost: {
        background: 'transparent',
        color: 'var(--text)',
        border: 'none',
      },
      danger: {
        background: 'linear-gradient(135deg, var(--danger) 0%, #dc2626 100%)',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
      },
      success: {
        background: 'linear-gradient(135deg, var(--success) 0%, #16a34a 100%)',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
      },
    }

    const hoverStyles: Record<string, React.CSSProperties> = {
      primary: { background: 'linear-gradient(135deg, var(--primary-2) 0%, var(--primary) 100%)', transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(45, 212, 191, 0.4)' },
      secondary: { background: 'var(--border)', borderColor: 'var(--primary)' },
      outline: { background: 'rgba(45, 212, 191, 0.1)' },
      ghost: { background: 'var(--panel-2)' },
      danger: { background: 'linear-gradient(135deg, #dc2626 0%, var(--danger) 100%)', transform: 'translateY(-1px)' },
      success: { background: 'linear-gradient(135deg, #16a34a 0%, var(--success) 100%)', transform: 'translateY(-1px)' },
    }

    const activeStyles: Record<string, React.CSSProperties> = {
      primary: { transform: 'translateY(0)', boxShadow: '0 2px 6px rgba(45, 212, 191, 0.3)' },
      secondary: { background: 'var(--panel)' },
      outline: { background: 'rgba(45, 212, 191, 0.15)' },
      ghost: { background: 'var(--border)' },
      danger: { transform: 'translateY(0)' },
      success: { transform: 'translateY(0)' },
    }

    const combinedStyle: React.CSSProperties = {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...style,
    }

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && !loading) {
        Object.assign(e.currentTarget.style, hoverStyles[variant])
      }
      props.onMouseEnter?.(e)
    }

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && !loading) {
        Object.assign(e.currentTarget.style, combinedStyle)
      }
      props.onMouseLeave?.(e)
    }

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && !loading) {
        Object.assign(e.currentTarget.style, activeStyles[variant])
      }
      props.onMouseDown?.(e)
    }

    const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && !loading) {
        Object.assign(e.currentTarget.style, hoverStyles[variant])
      }
      props.onMouseUp?.(e)
    }

    return (
      <button
        ref={ref}
        className={className}
        style={combinedStyle}
        disabled={disabled || loading}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        {...props}
      >
        {loading ? (
          <Icon name="loader" size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className="spin" />
        ) : (
          <>
            {leftIcon && <Icon name={leftIcon as any} size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
            {children}
            {rightIcon && <Icon name={rightIcon as any} size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
          </>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
export default Button