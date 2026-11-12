import React, { useEffect, useRef } from 'react'
import { Icon } from './Icon'
import { Button } from './Button'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  footer?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  footer,
  className = '',
  style,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
      contentRef.current?.focus()
    } else {
      document.body.style.overflow = ''
      previousActiveElement.current?.focus()
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open || !closeOnEscape) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, closeOnEscape, onClose])

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose()
    }
  }

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { maxWidth: 400 },
    md: { maxWidth: 560 },
    lg: { maxWidth: 720 },
    xl: { maxWidth: 960 },
    full: { maxWidth: 'calc(100vw - 48px)', width: 'calc(100vw - 48px)' },
  }

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 200ms ease',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className={className}
        style={{
          width: '100%',
          maxHeight: 'calc(100vh - 48px)',
          overflow: 'hidden',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4), 0 8px 16px rgba(0, 0, 0, 0.2)',
          animation: 'slideUp 200ms ease',
          display: 'flex',
          flexDirection: 'column',
          ...sizeStyles[size],
          ...style,
        }}
      >
        {(title || showCloseButton) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <div style={{ flex: 1 }}>
              {title && (
                <h2 id="modal-title" style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-description" style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  opacity: 0.7,
                  transition: 'all 150ms ease',
                  flexShrink: 0,
                }}
                onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--panel-2)' }}
                onMouseOut={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'transparent' }}
                aria-label="Close"
              >
                <Icon name="x" size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>{children}</div>
        {footer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 12,
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
}) => {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6 }}>{message}</p>
      <div
        slot="footer"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export default Modal