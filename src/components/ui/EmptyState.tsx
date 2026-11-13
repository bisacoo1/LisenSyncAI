import React from 'react'
import { Icon, type IconName } from './Icon'
import { Button } from './Button'

export interface EmptyStateProps {
  icon?: IconName
  title: string
  description?: string
  action?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'outline' }
  secondaryAction?: { label: string; onClick: () => void }
  className?: string
  style?: React.CSSProperties
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon = 'info', title, description, action, secondaryAction, className = '', style }) => (
  <div className={`ui-empty-state ${className}`.trim()} style={style}>
    <span className="ui-empty-state-icon"><Icon name={icon} size={27} /></span>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {(action || secondaryAction) && <div className="ui-empty-state-actions">
      {action && <Button variant={action.variant || 'primary'} onClick={action.onClick}>{action.label}</Button>}
      {secondaryAction && <Button variant="secondary" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>}
    </div>}
  </div>
)

export default EmptyState
