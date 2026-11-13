import React from 'react'
import { Icon, type IconName } from './Icon'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | 'filled'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = 'default', padding = 'md', hoverable, className = '', style, ...props }, ref) => (
    <div
      ref={ref}
      className={`ui-card ui-card--${variant} ui-card--${padding}${hoverable ? ' ui-card--hoverable' : ''} ${className}`.trim()}
      style={style}
      {...props}
    >
      {children}
    </div>
  )
)

Card.displayName = 'Card'

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  icon?: IconName
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, subtitle, action, icon, children, className = '', style, ...props }, ref) => (
    <div ref={ref} className={`ui-card-header ${className}`.trim()} style={style} {...props}>
      <div className="ui-card-header-main">
        {icon && <span className="ui-card-header-icon"><Icon name={icon} size={19} /></span>}
        <div className="ui-card-header-copy">
          {title && <h3>{title}</h3>}
          {subtitle && <p>{subtitle}</p>}
          {children}
        </div>
      </div>
      {action && <div className="ui-card-header-action">{action}</div>}
    </div>
  )
)

CardHeader.displayName = 'CardHeader'

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className = '', style, ...props }, ref) => <div ref={ref} className={className} style={style} {...props}>{children}</div>
)

CardContent.displayName = 'CardContent'

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = '', style, ...props }, ref) => (
    <div ref={ref} className={`ui-card-footer ${className}`.trim()} style={style} {...props}>{children}</div>
  )
)

CardFooter.displayName = 'CardFooter'
export default Card
