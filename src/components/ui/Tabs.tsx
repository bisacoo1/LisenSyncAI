import React from 'react'
import { Icon } from './Icon'

export interface TabItem {
  value: string
  label: string
  icon?: string
  count?: number
  disabled?: boolean
}

export interface TabsProps {
  tabs: TabItem[]
  value: string
  onChange: (value: string) => void
  variant?: 'line' | 'pills' | 'enclosed'
  fullWidth?: boolean
  className?: string
  style?: React.CSSProperties
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  value,
  onChange,
  variant = 'line',
  fullWidth,
  className = '',
  style,
}) => {
  const variantStyles: Record<string, React.CSSProperties> = {
    line: {
      borderBottom: '1px solid var(--border)',
      gap: 0,
    },
    pills: {
      background: 'var(--panel-2)',
      borderRadius: 10,
      padding: 4,
      gap: 4,
    },
    enclosed: {
      background: 'var(--panel-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      gap: 0,
    },
  }

  const tabStyles = (tab: TabItem, isActive: boolean) => {
    const base: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      fontSize: 13,
      fontWeight: 600,
      color: isActive ? 'var(--primary)' : 'var(--muted)',
      background: 'transparent',
      border: 'none',
      cursor: tab.disabled ? 'not-allowed' : 'pointer',
      transition: 'all 150ms ease',
      opacity: tab.disabled ? 0.5 : 1,
      whiteSpace: 'nowrap',
      fontFamily: 'inherit',
    }

    if (variant === 'line') {
      return {
        ...base,
        padding: '12px 16px',
        borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
        marginBottom: -1,
      }
    } else if (variant === 'pills') {
      return {
        ...base,
        padding: '8px 16px',
        borderRadius: 8,
        background: isActive ? 'var(--panel)' : 'transparent',
        boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none',
      }
    } else {
      return {
        ...base,
        padding: '10px 16px',
        borderRight: tab.value !== tabs[tabs.length - 1].value ? '1px solid var(--border)' : 'none',
        background: isActive ? 'var(--panel)' : 'transparent',
      }
    }
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    width: fullWidth ? '100%' : 'auto',
    ...variantStyles[variant],
    ...style,
  }

  return (
    <div className={className} style={containerStyle} role="tablist">
      {tabs.map((tab, idx) => {
        const isActive = tab.value === value
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.value}`}
            id={`tab-${tab.value}`}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.value)}
            style={tabStyles(tab, isActive)}
          >
            {tab.icon && <Icon name={tab.icon as any} size={16} />}
            {tab.label}
            {tab.count != null && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: isActive ? 'var(--primary)' : 'var(--border)',
                  color: isActive ? '#041014' : 'var(--muted)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export interface TabPanelsProps {
  children: React.ReactNode
}

export const TabPanels: React.FC<TabPanelsProps> = ({ children }) => {
  return <div style={{ marginTop: 16 }}>{children}</div>
}

export interface TabPanelProps {
  value: string
  activeValue: string
  children: React.ReactNode
}

export const TabPanel: React.FC<TabPanelProps> = ({ value, activeValue, children }) => {
  if (value !== activeValue) return null
  return <div role="tabpanel" id={`panel-${value}`} style={{ animation: 'fadeIn 200ms ease' }}>{children}</div>
}

export default Tabs