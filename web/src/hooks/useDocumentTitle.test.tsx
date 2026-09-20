import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDocumentTitle } from './useDocumentTitle'

describe('useDocumentTitle', () => {
  it('sets the tab title with the app name suffixed', () => {
    renderHook(() => useDocumentTitle('Chorus Jig'))

    expect(document.title).toBe("Chorus Jig - Caller's Kit")
  })

  it('falls back to just the app name when given null or undefined', () => {
    renderHook(() => useDocumentTitle(null))
    expect(document.title).toBe("Caller's Kit")

    renderHook(() => useDocumentTitle(undefined))
    expect(document.title).toBe("Caller's Kit")
  })

  it('updates the title when the given title changes', () => {
    const { rerender } = renderHook<void, { title: string | null }>(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Dances' },
    })
    expect(document.title).toBe("Dances - Caller's Kit")

    rerender({ title: 'Programs' })
    expect(document.title).toBe("Programs - Caller's Kit")
  })
})
