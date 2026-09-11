import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDragBodyClass } from './useDragBodyClass'

describe('useDragBodyClass', () => {
  it('starts false, without the body class applied', () => {
    const { result } = renderHook(() => useDragBodyClass())

    expect(result.current[0]).toBe(false)
    expect(document.body.classList.contains('is-dragging-column')).toBe(false)
  })

  it('adds the body class once set true, and removes it once set back to false', () => {
    const { result } = renderHook(() => useDragBodyClass())

    act(() => {
      result.current[1](true)
    })
    expect(result.current[0]).toBe(true)
    expect(document.body.classList.contains('is-dragging-column')).toBe(true)

    act(() => {
      result.current[1](false)
    })
    expect(result.current[0]).toBe(false)
    expect(document.body.classList.contains('is-dragging-column')).toBe(false)
  })

  it('removes the body class on unmount, even mid-drag', () => {
    const { result, unmount } = renderHook(() => useDragBodyClass())

    act(() => {
      result.current[1](true)
    })
    expect(document.body.classList.contains('is-dragging-column')).toBe(true)

    unmount()

    expect(document.body.classList.contains('is-dragging-column')).toBe(false)
  })
})
