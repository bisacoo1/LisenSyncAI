import React, { useState, useEffect, createContext, useContext } from 'react'
import { Icon } from './Icon'
import { Button } from './Button'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'default'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  placement?: 'center'
  action?: { label: string; onClick: () => void }
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9)
    const newToast = { ...toast, id }
    setToasts((prev) => [...prev, newToast])
    return id
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  const typeStyles: Record<ToastType, React.CSSProperties> = {
    success: { borderLeftColor: 'var(--success)' },
    error: { borderLeftColor: 'var(--danger)' },
    warning: { borderLeftColor: 'var(--warning)' },
    info: { borderLeftColor: 'var(--info)' },
    default: { borderLeftColor: 'var(--primary)' },
  }

  const typeIcons: Record<ToastType, string> = {
    success: 'check-circle',
    error: 'x-circle',
    warning: 'alert-triangle',
    info: 'info',
    default: 'bell',
  }

  const typeTitleColors: Record<ToastType, string> = {
    success: 'var(--success)',
    error: 'var(--danger)',
    warning: 'var(--warning)',
    info: 'var(--info)',
    default: 'var(--primary)',
  }

  return (
    <>
      <div
        className="toast-container"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.filter(toast => !toast.placement).map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </div>
      {toasts.some(toast => toast.placement === 'center') && (
        <div
          className="toast-container toast-container--center"
          role="region"
          aria-label="Status message"
          aria-live="polite"
          aria-atomic="true"
        >
          {toasts.filter(toast => toast.placement === 'center').map(toast => (
            <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
          ))}
        </div>
      )}
    </>
  )
}

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onRemove(toast.id), 200)
    }, toast.duration ?? 5000)
    return () => clearTimeout(timer)
  }, [toast, onRemove])

  const typeStyles: Record<ToastType, React.CSSProperties> = {
    success: { borderLeftColor: 'var(--success)' },
    error: { borderLeftColor: 'var(--danger)' },
    warning: { borderLeftColor: 'var(--warning)' },
    info: { borderLeftColor: 'var(--info)' },
    default: { borderLeftColor: 'var(--primary)' },
  }

  const typeIcons: Record<ToastType, string> = {
    success: 'check-circle',
    error: 'x-circle',
    warning: 'alert-triangle',
    info: 'info',
    default: 'bell',
  }

  const typeTitleColors: Record<ToastType, string> = {
    success: 'var(--success)',
    error: 'var(--danger)',
    warning: 'var(--warning)',
    info: 'var(--info)',
    default: 'var(--primary)',
  }

  // Use role="alert" for error and success toasts to ensure they're announced
  const isAlert = toast.type === 'error' || toast.type === 'success'
  const isCentered = toast.placement === 'center'

  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '14px 16px',
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    borderLeftWidth: 4,
    ...typeStyles[toast.type],
    boxShadow: 'var(--shadow-lg)',
    transform: isCentered
      ? exiting ? 'scale(.94) translateY(-4px)' : visible ? 'scale(1) translateY(0)' : 'scale(.9) translateY(12px)'
      : exiting ? 'translateX(120%)' : visible ? 'translateX(0)' : 'translateX(120%)',
    opacity: exiting ? 0 : visible ? 1 : 0,
    transition: isCentered
      ? 'transform 280ms cubic-bezier(.2,.8,.2,1), opacity 200ms ease'
      : 'all 200ms ease',
    pointerEvents: 'auto',
    minWidth: isCentered ? 'min(300px, calc(100vw - 32px))' : 300,
  }

  return (
    <div className={`toast-item${isCentered ? ' toast-item--center' : ''}`} style={style} role={isAlert ? 'alert' : undefined} aria-live={isAlert ? 'assertive' : undefined} aria-atomic={isAlert ? true : undefined}>
      <Icon name={typeIcons[toast.type] as any} size={20} style={{ color: typeTitleColors[toast.type], flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: typeTitleColors[toast.type] }}>{toast.title}</div>
        {toast.message && <div style={{ marginTop: 2, fontSize: 13, color: 'var(--muted)' }}>{toast.message}</div>}
        {toast.action && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { toast.action?.onClick(); onRemove(toast.id) }}
            style={{ marginTop: 8 }}
          >
            {toast.action.label}
          </Button>
        )}
      </div>
      <button
        onClick={() => { setExiting(true); setTimeout(() => onRemove(toast.id), 200) }}
        aria-label="Dismiss notification"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: 'var(--muted)',
          cursor: 'pointer',
          opacity: 0.6,
          transition: 'all 150ms ease',
          flexShrink: 0,
        }}
        onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--panel-2)' }}
        onMouseOut={(e) => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'transparent' }}
      >
        <Icon name="x" size={14} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  )
}

export default ToastProvider