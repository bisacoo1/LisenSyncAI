import React from 'react'
import { Icon } from './Icon'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: string
  rightIcon?: string
  rightElement?: React.ReactNode
  fullWidth?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      rightElement,
      fullWidth,
      className = '',
      style,
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id || React.useId()

    const baseStyles: React.CSSProperties = {
      width: fullWidth ? '100%' : 'auto',
      flex: fullWidth ? 1 : 0,
      background: 'var(--panel-2)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 14,
      fontFamily: 'inherit',
      transition: 'all 150ms ease',
      outline: 'none',
    }

    const focusStyles: React.CSSProperties = {
      borderColor: 'var(--primary)',
      boxShadow: '0 0 0 3px rgba(45, 212, 191, 0.15)',
    }

    const errorStyles: React.CSSProperties = {
      borderColor: 'var(--danger)',
      boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)',
    }

    const disabledStyles: React.CSSProperties = {
      opacity: 0.5,
      cursor: 'not-allowed',
    }

    const [focused, setFocused] = React.useState(false)

    const combinedStyle: React.CSSProperties = {
      ...baseStyles,
      ...(focused && !error && focusStyles),
      ...(error && errorStyles),
      ...(disabled && disabledStyles),
      ...style,
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: fullWidth ? '100%' : 'auto' }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {label}
            {required && <span style={{ color: 'var(--danger)' }}>*</span>}
          </label>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {leftIcon && (
            <div
              style={{
                position: 'absolute',
                left: 12,
                color: 'var(--muted)',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              <Icon name={leftIcon as any} size={18} />
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={className}
            style={{
              ...combinedStyle,
              paddingLeft: leftIcon ? 42 : 14,
              paddingRight: rightIcon || rightElement ? 42 : 14,
            }}
            disabled={disabled}
            required={required}
            onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
            onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
            {...props}
          />
          {(rightIcon || rightElement) && (
            <div
              style={{
                position: 'absolute',
                right: 12,
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {rightIcon ? <Icon name={rightIcon as any} size={18} /> : rightElement}
            </div>
          )}
        </div>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', fontSize: 12 }}>
            <Icon name="alert-circle" size={14} />
            <span>{error}</span>
          </div>
        )}
        {hint && !error && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  fullWidth?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, fullWidth, className = '', style, id, disabled, required, ...props }, ref) => {
    const textareaId = id || React.useId()
    const [focused, setFocused] = React.useState(false)

    const baseStyles: React.CSSProperties = {
      width: fullWidth ? '100%' : 'auto',
      flex: fullWidth ? 1 : 0,
      background: 'var(--panel-2)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '12px 14px',
      fontSize: 14,
      fontFamily: 'inherit',
      transition: 'all 150ms ease',
      outline: 'none',
      resize: 'vertical',
      minHeight: 100,
    }

    const combinedStyle: React.CSSProperties = {
      ...baseStyles,
      ...(focused && !error && { borderColor: 'var(--primary)', boxShadow: '0 0 0 3px rgba(45, 212, 191, 0.15)' }),
      ...(error && { borderColor: 'var(--danger)', boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)' }),
      ...(disabled && { opacity: 0.5, cursor: 'not-allowed' }),
      ...style,
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: fullWidth ? '100%' : 'auto' }}>
        {label && (
          <label
            htmlFor={textareaId}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {label}
            {required && <span style={{ color: 'var(--danger)' }}>*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={className}
          style={combinedStyle}
          disabled={disabled}
          required={required}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
          {...props}
        />
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', fontSize: 12 }}>
            <Icon name="alert-circle" size={14} />
            <span>{error}</span>
          </div>
        )}
        {hint && !error && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{hint}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export default Input