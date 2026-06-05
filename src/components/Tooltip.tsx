import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/format'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  className?: string
  placement?: 'top' | 'bottom'
  width?: number
  gap?: number
}

/**
 * Hover-tooltip that escapes any ancestor `overflow: hidden` / `backdrop-filter`
 * (which the `.glass-panel` uses for its gradient blob decorations). We render
 * the popup through a portal at `document.body` and position it with
 * `position: fixed`, so nothing in the React tree can clip it.
 */
export default function Tooltip({
  content,
  children,
  className,
  placement = 'top',
  width = 288,
  gap = 8,
}: TooltipProps) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const updatePos = () => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Center horizontally; clamp to viewport with 8px margin.
    let left = rect.left + rect.width / 2 - width / 2
    left = Math.max(8, Math.min(left, vw - width - 8))

    // Top or bottom of trigger.
    let top: number
    if (placement === 'top') {
      top = rect.top - gap
    } else {
      top = rect.bottom + gap
    }
    // If off-screen, flip.
    if (placement === 'top' && top < 80) {
      top = rect.bottom + gap
    } else if (placement === 'bottom' && top + 80 > vh) {
      top = rect.top - gap
    }
    setPos({ top, left })
  }

  useEffect(() => {
    if (!show) return
    updatePos()
    const onChange = () => updatePos()
    window.addEventListener('scroll', onChange, true)
    window.addEventListener('resize', onChange)
    return () => {
      window.removeEventListener('scroll', onChange, true)
      window.removeEventListener('resize', onChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, placement, width, gap])

  return (
    <div
      ref={triggerRef}
      className={cn('relative cursor-help', className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      tabIndex={0}
    >
      {children}
      {show && pos && typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width,
              transform: placement === 'top' ? 'translateY(-100%)' : 'none',
            }}
            className="z-[9999] rounded-lg border border-cyan/30 bg-ink-950/95 px-3 py-2.5 text-[11px] leading-relaxed text-text-secondary shadow-glow backdrop-blur-md pointer-events-none"
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  )
}

/** A small visual helper for the API-field reference at the bottom of a tip. */
export function TipApiField({ name }: { name: string }) {
  return (
    <div className="mt-1.5 border-t border-ink-700/60 pt-1.5 font-mono text-[10px] text-text-muted">
      API: <span className="text-cyan">{name}</span>
    </div>
  )
}
