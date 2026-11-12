import React from 'react'
import { Icon } from './Icon'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: SelectOption[]
  placeholder?: string
  fullWidth?: boolean
  leftIcon?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      options,
      placeholder,
      fullWidth,
      leftIcon,
      className = '',
      style,
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const selectId = id || React.useId()
    const [focused, setFocused] = React.useState(false)

    const baseStyle: React.CSSProperties = {
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
      cursor: disabled ? 'not-allowed' : 'pointer',
      appearance: 'none',
      paddingRight: 42,
    }

    const combinedStyle: React.CSSProperties = {
      ...baseStyle,
      ...(focused && !error && { borderColor: 'var(--primary)', boxShadow: '0 0 0 3px rgba(45, 212, 191, 0.15)' }),
      ...(error && { borderColor: 'var(--danger)', boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)' }),
      ...(disabled && { opacity: 0.5, cursor: 'not-allowed' }),
      ...style,
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: fullWidth ? '100%' : 'auto' }}>
        {label && (
          <label
            htmlFor={selectId}
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
          <select
            ref={ref}
            id={selectId}
            className={className}
            style={{
              ...combinedStyle,
              paddingLeft: leftIcon ? 42 : 14,
            }}
            disabled={disabled}
            required={required}
            onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
            onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <div
            style={{
              position: 'absolute',
              right: 12,
              color: 'var(--muted)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Icon name="chevron-down" size={16} />
          </div>
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

Select.displayName = 'Select'
export default Select