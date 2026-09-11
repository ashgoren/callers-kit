import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLongPressTouch } from './useLongPressTouch'
import type { TouchEvent as ReactTouchEvent } from 'react'

// A minimal stand-in for the React synthetic touch event useLongPressTouch's
// returned handler reads - only the fields it actually touches (touches,
// cancelable, preventDefault, nativeEvent), not a full TouchEvent shape.
// preventDefault is returned as its own reference (not read back off event
// later) so a test can assert on it without triggering
// @typescript-eslint/unbound-method.
function makeTouchStartEvent(clientX: number, clientY: number) {
  const preventDefault = vi.fn()
  const nativeEvent = { type: 'touchstart' }
  const event = {
    touches: [{ clientX, clientY }],
    cancelable: true,
    preventDefault,
    nativeEvent,
  } as unknown as ReactTouchEvent<HTMLElement>
  return { event, preventDefault, nativeEvent }
}

// The hook's own touchmove/touchend/touchcancel listeners are added directly
// on document (not on any rendered element), so document is also where a
// test has to dispatch them.
function dispatchTouchMove(clientX: number, clientY: number) {
  document.dispatchEvent(
    new TouchEvent('touchmove', { touches: [{ clientX, clientY }] as unknown as Touch[], bubbles: true, cancelable: true }),
  )
}

function dispatchTouchEnd() {
  document.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true }))
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  // Ends whatever gesture a test left hanging, so its document-level
  // listeners don't leak into the next test - a no-op if the gesture already
  // ended itself (via activation or its own touchend).
  act(() => {
    dispatchTouchEnd()
  })
  vi.useRealTimers()
})

describe('useLongPressTouch', () => {
  it('calls preventDefault on the initial touchstart', () => {
    const { result } = renderHook(() => useLongPressTouch({ delay: 500, tolerance: 5, onActivate: vi.fn() }))
    const { event, preventDefault } = makeTouchStartEvent(100, 100)

    act(() => {
      result.current(event)
    })

    expect(preventDefault).toHaveBeenCalled()
  })

  it('calls onActivate with the native event once the touch holds still for the full delay', () => {
    const onActivate = vi.fn()
    const { result } = renderHook(() => useLongPressTouch({ delay: 500, tolerance: 5, onActivate }))
    const { event, nativeEvent } = makeTouchStartEvent(100, 100)

    act(() => {
      result.current(event)
    })
    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(onActivate).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onActivate).toHaveBeenCalledWith(nativeEvent)
  })

  it('still activates on schedule despite movement within tolerance', () => {
    const onActivate = vi.fn()
    const { result } = renderHook(() => useLongPressTouch({ delay: 500, tolerance: 5, onActivate }))

    act(() => {
      result.current(makeTouchStartEvent(100, 100).event)
    })
    act(() => {
      dispatchTouchMove(103, 100) // 3px - within the 5px tolerance
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onActivate).toHaveBeenCalled()
  })

  it('cancels activation once movement exceeds tolerance, without scrolling for that crossing move itself', () => {
    const onActivate = vi.fn()
    const onScroll = vi.fn()
    const { result } = renderHook(() => useLongPressTouch({ delay: 500, tolerance: 5, onActivate, onScroll }))

    act(() => {
      result.current(makeTouchStartEvent(100, 100).event)
    })
    act(() => {
      dispatchTouchMove(130, 100) // 30px - past the 5px tolerance
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onActivate).not.toHaveBeenCalled()
    expect(onScroll).not.toHaveBeenCalled()
  })

  it('calls onScroll with the delta from the crossing point, once movement continues past tolerance', () => {
    const onScroll = vi.fn()
    const { result } = renderHook(() => useLongPressTouch({ delay: 500, tolerance: 5, onActivate: vi.fn(), onScroll }))

    act(() => {
      result.current(makeTouchStartEvent(100, 100).event)
    })
    act(() => {
      dispatchTouchMove(130, 100) // crosses tolerance - not itself scrolled, see hook's own comment
    })
    act(() => {
      dispatchTouchMove(140, 100)
    })

    // startX at the crossing point (130) - newX(140): negative means the
    // finger moved right, which should decrease scrollLeft (reveal content to
    // the right) - the same sign convention ColumnResizeHandle's onScroll
    // passes straight to scrollBy({ left: deltaX }).
    expect(onScroll).toHaveBeenCalledTimes(1)
    expect(onScroll).toHaveBeenCalledWith(-10)
  })

  it('stops responding to further movement or activation once the touch ends before the delay elapses', () => {
    const onActivate = vi.fn()
    const onScroll = vi.fn()
    const { result } = renderHook(() => useLongPressTouch({ delay: 500, tolerance: 5, onActivate, onScroll }))

    act(() => {
      result.current(makeTouchStartEvent(100, 100).event)
    })
    act(() => {
      dispatchTouchEnd()
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    act(() => {
      dispatchTouchMove(200, 100)
    })

    expect(onActivate).not.toHaveBeenCalled()
    expect(onScroll).not.toHaveBeenCalled()
  })
})
