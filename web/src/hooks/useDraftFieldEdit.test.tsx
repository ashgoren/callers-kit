import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { useDraftFieldEdit } from './useDraftFieldEdit'
import type { KeyboardEvent } from 'react'
import type { FieldEditState } from '@/components/fields/InlineEditableField'

// A minimal stand-in for the bits of a real KeyboardEvent onKeyDown reads -
// just enough to drive the hook, not a full synthetic event. preventDefault
// is returned as its own reference (not read back off event later) so a
// test can assert on it without triggering @typescript-eslint/unbound-method.
function makeKeyEvent(key: string) {
  const preventDefault = vi.fn()
  const stopPropagation = vi.fn()
  const event = { key, preventDefault, stopPropagation } as unknown as KeyboardEvent
  return { event, preventDefault, stopPropagation }
}

describe('useDraftFieldEdit', () => {
  it('starts with draft equal to the given value, unfocused, no error', () => {
    const { result } = renderHook(() => useDraftFieldEdit({ value: 'Chorus Jig', onCommit: vi.fn() }))

    expect(result.current.draft).toBe('Chorus Jig')
    expect(result.current.isFocused).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('tracks external value changes while unfocused', () => {
    const { result, rerender } = renderHook(({ value }) => useDraftFieldEdit({ value, onCommit: vi.fn() }), {
      initialProps: { value: 'Chorus Jig' },
    })

    rerender({ value: 'Money Musk' })

    expect(result.current.draft).toBe('Money Musk')
  })

  it('shows the just-committed value immediately, even before the value prop catches up to it', () => {
    // The real gap this guards against: onCommit's write is async, so the
    // reactive query feeding `value` back in hasn't necessarily caught up
    // the instant commit() unfocuses - without the optimistic bridge, this
    // would flash the stale pre-edit value for a moment.
    const { result, rerender } = renderHook(({ value }) => useDraftFieldEdit({ value, onCommit: vi.fn() }), {
      initialProps: { value: 'Chorus Jig Extended' },
    })

    act(() => result.current.onFocus())
    act(() => result.current.onChange('Chorus Jig'))
    act(() => result.current.onBlur())

    // Not yet re-rendered with a new value prop - still the stale one.
    expect(result.current.isFocused).toBe(false)
    expect(result.current.draft).toBe('Chorus Jig')

    // The prop is still stale here too (simulating the async gap before
    // the reactive query re-runs) - draft must not flash back to it.
    rerender({ value: 'Chorus Jig Extended' })
    expect(result.current.draft).toBe('Chorus Jig')

    // Once the prop actually catches up, nothing changes visibly.
    rerender({ value: 'Chorus Jig' })
    expect(result.current.draft).toBe('Chorus Jig')
  })

  it('shows a just-committed null immediately, for a field where null is itself a legitimate value', () => {
    // A bare `T | null` optimistic-value slot couldn't tell "committed to
    // null" apart from "nothing pending" for a field like this one - it
    // would fall straight through to the still-stale `value` prop instead.
    const { result, rerender } = renderHook<FieldEditState<number | null>, { value: number | null }>(
      ({ value }) => useDraftFieldEdit({ value, onCommit: vi.fn() }),
      { initialProps: { value: 3 } },
    )

    act(() => result.current.onFocus())
    act(() => result.current.onChange(null))
    act(() => result.current.onBlur())

    expect(result.current.draft).toBeNull()

    rerender({ value: 3 })
    expect(result.current.draft).toBeNull()

    rerender({ value: null })
    expect(result.current.draft).toBeNull()
  })

  it('stops tracking external value changes once focused, so an in-progress edit is never clobbered', () => {
    const { result, rerender } = renderHook(({ value }) => useDraftFieldEdit({ value, onCommit: vi.fn() }), {
      initialProps: { value: 'Chorus Jig' },
    })

    act(() => result.current.onFocus())
    act(() => result.current.onChange('Chorus Jig (editing)'))

    // An external update arrives mid-edit (e.g. synced from another device).
    rerender({ value: 'Money Musk' })

    expect(result.current.draft).toBe('Chorus Jig (editing)')
  })

  it('does not call onCommit on blur when the draft was never changed from the original value', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useDraftFieldEdit({ value: 'Chorus Jig', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.onBlur())

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.isFocused).toBe(false)
  })

  it('commits the draft on blur when there is no schema', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useDraftFieldEdit({ value: 'Chorus Jig', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.onChange('New Title'))
    act(() => result.current.onBlur())

    expect(onCommit).toHaveBeenCalledWith('New Title')
    expect(result.current.isFocused).toBe(false)
  })

  it('commits on Enter, the same as blur, and prevents the event\'s default behavior', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useDraftFieldEdit({ value: 'Chorus Jig', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.onChange('New Title'))
    const { event, preventDefault } = makeKeyEvent('Enter')
    act(() => result.current.onKeyDown(event))

    expect(onCommit).toHaveBeenCalledWith('New Title')
    expect(preventDefault).toHaveBeenCalled()
  })

  it('reverts to the last-committed value on Escape, without committing, and stops it there', () => {
    // stopPropagation matters once this field is nested inside something
    // with its own Escape handling (e.g. a modal dialog) - see VideosField,
    // which sits an EditableText inside a Dialog that would otherwise treat
    // a bubbled Escape as "close the whole dialog" instead of just this field.
    const onCommit = vi.fn()
    const { result } = renderHook(() => useDraftFieldEdit({ value: 'Chorus Jig', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.onChange('Abandoned edit'))
    const { event, stopPropagation } = makeKeyEvent('Escape')
    act(() => result.current.onKeyDown(event))

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.draft).toBe('Chorus Jig')
    expect(result.current.isFocused).toBe(false)
    expect(stopPropagation).toHaveBeenCalled()
  })

  it('commits when the draft passes the given schema', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useDraftFieldEdit({ value: 3, onCommit, schema: z.number().int().min(0).max(10) }))

    act(() => result.current.onFocus())
    act(() => result.current.onChange(7))
    act(() => result.current.onBlur())

    expect(onCommit).toHaveBeenCalledWith(7)
    expect(result.current.error).toBeNull()
    expect(result.current.isFocused).toBe(false)
  })

  it('shows an error and stays focused, without committing, when the draft fails the given schema', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() =>
      useDraftFieldEdit({ value: 3, onCommit, schema: z.number().int().min(0).max(10, { message: 'Must be 10 or less' }) }),
    )

    act(() => result.current.onFocus())
    act(() => result.current.onChange(99))
    act(() => result.current.onBlur())

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Must be 10 or less')
    expect(result.current.isFocused).toBe(true)
    expect(result.current.draft).toBe(99)
  })

  it('reverts, rather than re-showing the error, on a second commit attempt with the same still-invalid draft', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() =>
      useDraftFieldEdit({ value: 'Chorus Jig', onCommit, schema: z.string().min(1, 'Title is required') }),
    )

    act(() => result.current.onFocus())
    act(() => result.current.onChange(''))
    act(() => result.current.onBlur())
    expect(result.current.error).toBe('Title is required')
    expect(result.current.isFocused).toBe(true)

    // Blurring again without having changed the (still invalid) draft -
    // simulates a touch device with no Escape key to fall back on.
    act(() => result.current.onBlur())

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.error).toBeNull()
    expect(result.current.isFocused).toBe(false)
    expect(result.current.draft).toBe('Chorus Jig')
  })

  it('shows the new error, rather than reverting, when a second failed attempt has a different invalid draft', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() =>
      useDraftFieldEdit({ value: 3, onCommit, schema: z.number().int().min(0).max(10) }),
    )

    act(() => result.current.onFocus())
    act(() => result.current.onChange(99))
    act(() => result.current.onBlur())
    expect(result.current.error).not.toBeNull()

    act(() => result.current.onChange(-5))
    act(() => result.current.onBlur())

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.error).not.toBeNull()
    expect(result.current.isFocused).toBe(true)
    expect(result.current.draft).toBe(-5)
  })

  it('clears a previous error once a later commit attempt passes the schema', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useDraftFieldEdit({ value: 3, onCommit, schema: z.number().int().min(0).max(10) }))

    act(() => result.current.onFocus())
    act(() => result.current.onChange(99))
    act(() => result.current.onBlur())
    expect(result.current.error).not.toBeNull()

    act(() => result.current.onChange(5))
    act(() => result.current.onBlur())

    expect(result.current.error).toBeNull()
    expect(onCommit).toHaveBeenCalledWith(5)
  })
})
