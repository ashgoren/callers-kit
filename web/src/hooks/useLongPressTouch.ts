import type { TouchEvent as ReactTouchEvent } from 'react'

interface LongPressTouchOptions {
  delay: number
  tolerance: number
  // Called once the touch has held within tolerance for the full delay.
  onActivate: (event: TouchEvent) => void
  // Called repeatedly with the horizontal delta (px, positive = finger moved
  // left) once movement exceeds tolerance before the delay elapses - lets a
  // caller take over scrolling manually instead of leaving the gesture a dead
  // zone. Omit if there's nothing to scroll.
  onScroll?: (deltaX: number) => void
}

// A touch that has to hold still before it "activates", rather than
// activating immediately - for a target where an immediate touch action
// would otherwise conflict with an ordinary scroll swipe starting on the same
// spot. Currently used only by DancesPage.ColumnResizeHandle.tsx, for its
// resize handles: TanStack's resize handler has no delay concept of its own,
// so this stands in for what dnd-kit's TouchSensor delay/tolerance
// activationConstraint does for the header's own drag-to-reorder (which goes
// through dnd-kit directly and doesn't need this hook).
//
// Calls preventDefault() on the touchstart itself, so the target this is
// wired to should already have touch-action: none - that's what actually
// keeps native scrolling from racing this gesture; preventDefault here only
// stops browser-native side effects of the touch itself (e.g. iOS Safari's
// compatibility mousedown emulation for an unprevented touchstart).
export function useLongPressTouch({ delay, tolerance, onActivate, onScroll }: LongPressTouchOptions) {
  return function handleTouchStart(event: ReactTouchEvent<HTMLElement>) {
    const touch = event.touches[0]
    if (!touch) return
    if (event.cancelable) event.preventDefault()

    const startX = touch.clientX
    const startY = touch.clientY
    const nativeEvent = event.nativeEvent
    let isPastTolerance = false
    let lastX = startX

    function onTouchMove(moveEvent: TouchEvent) {
      const moveTouch = moveEvent.touches[0]
      if (!moveTouch) return

      if (isPastTolerance) {
        onScroll?.(lastX - moveTouch.clientX)
        lastX = moveTouch.clientX
        return
      }

      // The move that crosses tolerance only flips isPastTolerance - it isn't
      // itself passed to onScroll, so the few px between the start and this
      // point are never applied as a scroll delta. Only moves after this one
      // are.
      if (Math.abs(moveTouch.clientX - startX) > tolerance || Math.abs(moveTouch.clientY - startY) > tolerance) {
        window.clearTimeout(timeoutId)
        isPastTolerance = true
        lastX = moveTouch.clientX
      }
    }

    function endGesture() {
      window.clearTimeout(timeoutId)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', endGesture)
      document.removeEventListener('touchcancel', endGesture)
    }

    const timeoutId = window.setTimeout(() => {
      endGesture()
      onActivate(nativeEvent)
    }, delay)

    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', endGesture)
    document.addEventListener('touchcancel', endGesture)
  }
}
