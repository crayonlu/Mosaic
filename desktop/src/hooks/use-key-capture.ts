import { useState, useEffect, useRef, useCallback } from 'react'

export interface KeyCombo {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  key: string
}

function formatKeyCombo(combo: KeyCombo | null): string {
  if (!combo) return ''

  const parts: string[] = []
  if (combo.ctrl) parts.push('Ctrl')
  if (combo.alt) parts.push('Alt')
  if (combo.shift) parts.push('Shift')
  if (combo.meta) parts.push(navigator.platform.includes('Mac') ? 'Cmd' : 'Meta')
  if (combo.key) {
    parts.push(combo.key.toUpperCase())
  }

  return parts.length > 0 ? parts.join('+') : ''
}

function getKeyName(event: KeyboardEvent): string {
  if (event.key === ' ') return 'Space'
  if (event.key === 'Enter') return 'Enter'
  if (event.key === 'Escape') return 'Escape'
  if (event.key.startsWith('F') && /^F\d+$/.test(event.key)) {
    return event.key
  }

  if (event.key.length === 1) {
    return event.key.toUpperCase()
  }

  return event.key
}

export function useKeyCapture() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [capturedCombo, setCapturedCombo] = useState<KeyCombo | null>(null)
  const comboRef = useRef<KeyCombo | null>(null)
  const keysPressedRef = useRef<Set<string>>(new Set())

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const key = event.key

    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      keysPressedRef.current.add(key)
      const combo: KeyCombo = {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
        key: '',
      }
      comboRef.current = combo
      setCapturedCombo(combo)
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const combo: KeyCombo = {
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
      key: getKeyName(event),
    }

    comboRef.current = combo
    setCapturedCombo(combo)
    setIsCapturing(false)
    keysPressedRef.current.clear()
  }, [])

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const key = event.key
    keysPressedRef.current.delete(key)

    if (
      keysPressedRef.current.size === 0 &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey &&
      !event.metaKey
    ) {
      setIsCapturing(false)
    }
  }, [])

  const startCapture = useCallback(() => {
    setIsCapturing(true)
    setCapturedCombo(null)
    comboRef.current = null
    keysPressedRef.current.clear()
  }, [])

  const stopCapture = useCallback(() => {
    setIsCapturing(false)
  }, [])

  useEffect(() => {
    if (isCapturing) {
      window.addEventListener('keydown', handleKeyDown, true)
      window.addEventListener('keyup', handleKeyUp, true)
      return () => {
        window.removeEventListener('keydown', handleKeyDown, true)
        window.removeEventListener('keyup', handleKeyUp, true)
      }
    }
  }, [isCapturing, handleKeyDown, handleKeyUp])

  const formattedCombo = formatKeyCombo(capturedCombo)

  return {
    isCapturing,
    capturedCombo,
    formattedCombo,
    startCapture,
    stopCapture,
  }
}
