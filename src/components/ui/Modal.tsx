import React, { useEffect, useRef, useCallback } from 'react'
import { Icon } from './Icon'
import { Button } from './Button'

// Focus trap utility
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(el => {
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null
  })
}

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
  onKeyDown?: (e: React.KeyboardEvent) => void
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
  onKeyDown,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
      // Focus trap: set up after render
      const setupFocusTrap = () => {
        const container = contentRef.current
        if (!container) return

        const focusableElements = getFocusableElements(container)
        if (focusableElements.length > 0) {
          focusableElements[0].focus()
        } else {
          container.focus()
        }

        const handleTab = (e: KeyboardEvent) => {
          if (e.key !== 'Tab') return
          const focusableElements = getFocusableElements(container)
          if (focusableElements.length === 0) return

          const first = focusableElements[0]
          const last = focusableElements[focusableElements.length - 1]

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault()
              last.focus()
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault()
              first.focus()
            }
          }
        }

        container.addEventListener('keydown', handleTab)
        return () => container.removeEventListener('keydown', handleTab)
      }

      const cleanup = setupFocusTrap()
      return () => cleanup?.()
    } else {
      document.body.style.overflow = ''
      previousActiveElement.current?.focus()
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
      onKeyDown={(e) => { if (e.key === 'Escape' && closeOnEscape) onClose(); onKeyDown?.(e); }}
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