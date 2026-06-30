import { useCallback, useRef } from 'react'

interface Props {
  direction: 'horizontal' | 'vertical'
  onDelta: (delta: number) => void
}

export function ResizeDivider({ direction, onDelta }: Props) {
  const dragging = useRef(false)
  const last = useRef(0)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      last.current = direction === 'horizontal' ? e.clientY : e.clientX

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return
        const cur = direction === 'horizontal' ? ev.clientY : ev.clientX
        onDelta(cur - last.current)
        last.current = cur
      }
      const onUp = () => {
        dragging.current = false
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [direction, onDelta]
  )

  const isH = direction === 'horizontal'
  return (
    <div
      onMouseDown={onMouseDown}
      className="group/divider"
      style={{
        flexShrink: 0,
        width: isH ? '100%' : '8px',
        height: isH ? '8px' : '100%',
        background: 'transparent',
        cursor: isH ? 'row-resize' : 'col-resize',
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* slim handle — appears on hover, accent on active drag */}
      <div
        className="rounded-full bg-transparent transition-colors duration-150 group-hover/divider:bg-border-strong"
        style={{
          width: isH ? '32px' : '3px',
          height: isH ? '3px' : '32px',
        }}
      />
    </div>
  )
}
