import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  show: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function Modal({ show, onClose, title, children, footer }: ModalProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640)
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 640)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let openFrame = 0
    let closeFrame = 0
    let closeTimer: number | undefined

    if (show) {
      openFrame = requestAnimationFrame(() => {
        setVisible(true)
        requestAnimationFrame(() => setAnimating(true))
      })
    } else {
      closeFrame = requestAnimationFrame(() => setAnimating(false))
      closeTimer = window.setTimeout(() => setVisible(false), 200)
    }

    return () => {
      if (openFrame) cancelAnimationFrame(openFrame)
      if (closeFrame) cancelAnimationFrame(closeFrame)
      if (closeTimer) clearTimeout(closeTimer)
    }
  }, [show])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && show) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [show, onClose])

  if (!visible) return null

  return createPortal(
    <div className="relative z-[1000]" role="dialog" aria-modal="true">
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/15 backdrop-blur-md transition-opacity duration-200 ${animating ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`fixed inset-0 ${isMobile ? 'flex items-end justify-stretch' : 'flex items-center justify-center p-6'} overflow-y-auto`}
      >
        <div
          className={`relative flex w-full flex-col overflow-hidden bg-card shadow-lg ${isMobile ? 'max-w-full rounded-t-lg' : 'max-w-lg rounded-lg'} max-h-[calc(100vh-48px)] transition-all duration-200 ${animating ? (isMobile ? 'translate-y-0' : 'scale-100 opacity-100') : (isMobile ? 'translate-y-full' : 'scale-95 opacity-0')}`}
        >
          {isMobile && <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border" />}
          {title && (
            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
              <span className="text-[15px] font-semibold text-foreground">{title}</span>
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-md border-none bg-transparent text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className={`flex-1 overflow-y-auto ${isMobile ? 'px-4 py-3' : 'px-5 py-4'}`}>{children}</div>
          {footer && (
            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3" style={isMobile ? { paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' } : undefined}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
