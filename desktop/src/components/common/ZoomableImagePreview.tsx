import { AuthImage } from '@/components/common/AuthImage'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react'
import { PointerEvent, WheelEvent, useRef, useState } from 'react'

interface ZoomableImagePreviewProps {
  src: string
  alt?: string
  variant?: 'original' | 'thumb' | 'opt'
}

const MIN_SCALE = 1
const MAX_SCALE = 6
const SCALE_STEP = 0.35

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function ZoomableImagePreview({
  src,
  alt,
  variant = 'original',
}: ZoomableImagePreviewProps) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)
  const dragRef = useRef<{
    pointerId: number
    x: number
    y: number
    ox: number
    oy: number
  } | null>(null)

  const reset = () => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setRotation(0)
  }

  const zoomTo = (nextScale: number) => {
    const clamped = clamp(nextScale, MIN_SCALE, MAX_SCALE)
    setScale(clamped)
    if (clamped === 1) {
      setOffset({ x: 0, y: 0 })
    }
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    zoomTo(scale + (event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP))
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (scale <= 1) return

    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    setOffset({
      x: drag.ox + event.clientX - drag.x,
      y: drag.oy + event.clientY - drag.y,
    })
  }

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  const handleDoubleClick = () => {
    if (scale > 1) {
      reset()
      return
    }

    zoomTo(2.5)
  }

  return (
    <div
      className={cn(
        'mosaic-media-stage group relative select-none',
        scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
      )}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="h-full w-full will-change-transform"
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${rotation}deg) scale(${scale})`,
          transition: dragRef.current ? 'none' : 'transform 160ms ease',
        }}
      >
        <AuthImage
          key={src}
          src={src}
          variant={variant}
          alt={alt}
          draggable={false}
          className="h-full w-full object-contain"
        />
      </div>

      <div
        className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100"
        onPointerDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
        onDoubleClick={event => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-white hover:bg-white/15 hover:text-white"
          onPointerDown={event => event.stopPropagation()}
          onDoubleClick={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation()
            zoomTo(scale - SCALE_STEP)
          }}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-12 text-center text-[11px] tabular-nums text-white/80">
          {Math.round(scale * 100)}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-white hover:bg-white/15 hover:text-white"
          onPointerDown={event => event.stopPropagation()}
          onDoubleClick={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation()
            zoomTo(scale + SCALE_STEP)
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-white hover:bg-white/15 hover:text-white"
          onPointerDown={event => event.stopPropagation()}
          onDoubleClick={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation()
            setRotation(value => (value + 90) % 360)
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-white hover:bg-white/15 hover:text-white"
          onPointerDown={event => event.stopPropagation()}
          onDoubleClick={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation()
            zoomTo(MAX_SCALE)
          }}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
