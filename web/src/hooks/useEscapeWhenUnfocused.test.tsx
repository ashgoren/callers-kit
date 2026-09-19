import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEscapeWhenUnfocused } from './useEscapeWhenUnfocused'

function pressEscape() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
}

describe('useEscapeWhenUnfocused', () => {
  it('fires when Escape is pressed and nothing on the page has focus', () => {
    const onEscape = vi.fn()
    renderHook(() => useEscapeWhenUnfocused(onEscape))

    act(() => pressEscape())

    expect(onEscape).toHaveBeenCalledOnce()
  })

  it('does not fire while an input, textarea, or contenteditable element has focus', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    document.body.append(input, textarea, editable)

    for (const element of [input, textarea, editable]) {
      element.focus()
      const onEscape = vi.fn()
      renderHook(() => useEscapeWhenUnfocused(onEscape))

      act(() => pressEscape())

      expect(onEscape).not.toHaveBeenCalled()
    }

    input.remove()
    textarea.remove()
    editable.remove()
  })

  it('still fires while a plain button has focus - residual focus from clicking a toggle is not "editing" it', () => {
    // The actual bug this guards against: entering edit mode via a button
    // click leaves that button focused (ordinary browser behavior, nothing
    // to do with editing), which an activeElement !== document.body check
    // would wrongly treat as "a field is focused" and refuse to fire until
    // the user clicked elsewhere first.
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()
    const onEscape = vi.fn()
    renderHook(() => useEscapeWhenUnfocused(onEscape))

    act(() => pressEscape())

    expect(onEscape).toHaveBeenCalledOnce()
    button.remove()
  })

  it('ignores keys other than Escape', () => {
    const onEscape = vi.fn()
    renderHook(() => useEscapeWhenUnfocused(onEscape))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    })

    expect(onEscape).not.toHaveBeenCalled()
  })

  it('does nothing while disabled', () => {
    const onEscape = vi.fn()
    renderHook(() => useEscapeWhenUnfocused(onEscape, false))

    act(() => pressEscape())

    expect(onEscape).not.toHaveBeenCalled()
  })

  it('stops listening once unmounted', () => {
    const onEscape = vi.fn()
    const { unmount } = renderHook(() => useEscapeWhenUnfocused(onEscape))
    unmount()

    act(() => pressEscape())

    expect(onEscape).not.toHaveBeenCalled()
  })

  it('always calls the latest onEscape, not one captured from an earlier render', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ onEscape }) => useEscapeWhenUnfocused(onEscape), {
      initialProps: { onEscape: first },
    })

    rerender({ onEscape: second })
    act(() => pressEscape())

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})
