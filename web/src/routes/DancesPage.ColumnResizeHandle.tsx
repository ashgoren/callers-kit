import type { TouchEvent as ReactTouchEvent } from 'react'
import { useCoarsePointer } from '@/hooks/useCoarsePointer'
import type { LeafHeader, TableInstance } from './DancesPage.columns'

export function ColumnResizeHandle({ table, header }: { table: TableInstance; header: LeafHeader }) {
  const isCoarsePointer = useCoarsePointer()
  const resizeHandler = header.getResizeHandler()

  // Requires an actual long press before a resize starts on touch - the same
  // problem, and the same fix, as the header's own drag-to-reorder: the handle
  // sits right at a horizontally-scrolling table's edge, so a finger just
  // trying to scroll easily lands on it and would otherwise trigger a resize
  // on the very first touchmove. TanStack's resize handler has no delay
  // concept of its own (unlike dnd-kit's TouchSensor), so this hand-rolls the
  // same delay/tolerance/cancel pattern by hand.
  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    if (!touch) return
    if (event.cancelable) event.preventDefault()
    const startX = touch.clientX
    const startY = touch.clientY
    const nativeEvent = event.nativeEvent

    function onTouchMove(moveEvent: TouchEvent) {
      const moveTouch = moveEvent.touches[0]
      if (!moveTouch) return
      if (Math.abs(moveTouch.clientX - startX) > 5 || Math.abs(moveTouch.clientY - startY) > 5) {
        cancelPending()
      }
    }

    function cancelPending() {
      window.clearTimeout(timeoutId)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', cancelPending)
      document.removeEventListener('touchcancel', cancelPending)
    }

    const timeoutId = window.setTimeout(() => {
      cancelPending()
      resizeHandler(nativeEvent)
    }, 500)

    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', cancelPending)
    document.addEventListener('touchcancel', cancelPending)
  }

  return (
    <table.Subscribe selector={(state) => ({ columnResizing: state.columnResizing })}>
      {() => {
        // Reads state.columnResizing above (not just header.column.getIsResizing()
        // directly below) for the same React Compiler staleness reason documented
        // on SortableTableHead's table.Subscribe in TableView.tsx - getIsResizing()
        // hides its real dependency behind the stable header/column object.
        const isResizing = header.column.getIsResizing()

        return (
          <div
            onMouseDown={isCoarsePointer ? undefined : resizeHandler}
            onTouchStart={isCoarsePointer ? handleTouchStart : resizeHandler}
            // touch-none unconditionally (not just on a fine pointer) - unlike the
            // sort button, which spans the whole header and so needs to keep
            // native scrolling available, this is a narrow, now-visible target
            // where a swipe intended to scroll can simply start elsewhere. Letting
            // it double as a scroll surface (by omitting touch-none on a coarse
            // pointer, as the sort button does) turned out to race the browser's
            // own scroll-vs-gesture decision: that decision is made from the very
            // first touchmove of a sequence, before this delay/tolerance logic
            // above has run, so an ordinary bit of finger tremor while holding
            // still is sometimes enough for the browser to commit to scrolling -
            // a commitment no later preventDefault() (including TanStack's own,
            // once resize activates) can undo.
            className={`absolute top-0 right-0 h-full cursor-col-resize touch-none select-none ${
              isCoarsePointer
                ? `w-4 ${isResizing ? 'bg-primary/50' : 'bg-border/40'}`
                : 'w-1.5 hover:bg-primary/50 active:bg-primary/50'
            }`}
          >
            <div className={`mx-auto h-full bg-border ${isCoarsePointer ? 'w-0.5' : 'w-px'}`} />
          </div>
        )
      }}
    </table.Subscribe>
  )
}
