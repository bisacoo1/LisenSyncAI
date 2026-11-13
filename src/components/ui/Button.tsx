import React from 'react'
import { Icon, type IconName } from './Icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  leftIcon?: IconName
  rightIcon?: IconName
  loading?: boolean
  fullWidth?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', leftIcon, rightIcon, loading, fullWidth, className = '', disabled, type = 'button', ...props }, ref) => {
    const iconSize = size === 'sm' ? 15 : size === 'lg' ? 19 : 17
    return (
      <button
        ref={ref}
        type={type}
        className={`ui-button ui-button--${variant} ui-button--${size}${fullWidth ? ' ui-button--full' : ''} ${className}`.trim()}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Icon name="loader" size={iconSize} /> : leftIcon && <Icon name={leftIcon} size={iconSize} />}
        {children}
        {!loading && rightIcon && <Icon name={rightIcon} size={iconSize} />}
      </button>
    )
  }
)

Button.displayName = 'Button'
export default Button
