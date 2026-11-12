import React from 'react'
import { Icon } from './Icon'
import { Button } from './Button'

export interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'outline' }
  secondaryAction?: { label: string; onClick: () => void }
  className?: string
  style?: React.CSSProperties
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'info',
  title,
  description,
  action,
  secondaryAction,
  className = '',
  style,
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        ...style,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'rgba(45, 212, 191, 0.1)',
          color: 'var(--primary)',
          marginBottom: 20,
        }}
      >
        <Icon name={icon as any} size={32} />
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
      {description && (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', maxWidth: 320, lineHeight: 1.6 }}>{description}</p>
      )}
      {(action || secondaryAction) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          {action && (
            <Button variant={action.variant || 'primary'} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default EmptyState