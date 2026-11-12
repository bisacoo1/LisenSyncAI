import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface TooltipProps {
  content: string
  children: React.ReactElement
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
  className = '',
}) => {
  const [visible, setVisible] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const timeoutRef = useRef<number>()
  const childRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // Create portal target on mount
    const div = document.createElement('div')
    document.body.appendChild(div)
    setPortalTarget(div)
    return () => {
      document.body.removeChild(div)
      setPortalTarget(null)
    }
  }, [])

  const show = () => {
    timeoutRef.current = window.setTimeout(() => setVisible(true), delay)
  }

  const hide = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    setVisible(false)
  }

  const clonedChild = React.cloneElement(children as React.ReactElement<any>, {
    ref: childRef,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  })

  if (!visible || !portalTarget || !childRef.current) return clonedChild

  const rect = childRef.current.getBoundingClientRect()
  let top = 0, left = 0, transform = ''

  switch (position) {
    case 'top':
      top = rect.top - 8
      left = rect.left + rect.width / 2
      transform = 'translateX(-50%) translateY(-100%)'
      break
    case 'bottom':
      top = rect.bottom + 8
      left = rect.left + rect.width / 2
      transform = 'translateX(-50%)'
      break
    case 'left':
      top = rect.top + rect.height / 2
      left = rect.left - 8
      transform = 'translateY(-50%) translateX(-100%)'
      break
    case 'right':
      top = rect.top + rect.height / 2
      left = rect.right + 8
      transform = 'translateY(-50%)'
      break
  }

  const tooltip = (
    <div
      style={{
        position: 'fixed',
        top,
        left,
        transform,
        zIndex: 10000,
        padding: '6px 10px',
        background: 'var(--panel-3)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        fontSize: 12,
        color: 'var(--text)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        animation: 'fadeIn 150ms ease',
      }}
      className={className}
      role="tooltip"
    >
      {content}
    </div>
  )

  return (
    <>
      {clonedChild}
      {createPortal(tooltip, portalTarget)}
    </>
  )
}

export default Tooltip