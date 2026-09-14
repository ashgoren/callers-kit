import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSelectFieldEdit } from './useSelectFieldEdit'
import type { FieldEditState } from '@/components/fields/InlineEditableField'

describe('useSelectFieldEdit', () => {
  it('starts with draft equal to the given value, unfocused, no error', () => {
    const { result } = renderHook(() => useSelectFieldEdit({ value: 'Contra', onCommit: vi.fn() }))

    expect(result.current.draft).toBe('Contra')
    expect(result.current.isFocused).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('activates on focus', () => {
    const { result } = renderHook(() => useSelectFieldEdit({ value: 'Contra', onCommit: vi.fn() }))

    act(() => result.current.onFocus())

    expect(result.current.isFocused).toBe(true)
  })

  it('commits immediately on change, rather than waiting for a separate blur/Enter', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSelectFieldEdit({ value: 'Contra', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.onChange('Square'))

    expect(onCommit).toHaveBeenCalledWith('Square')
    expect(result.current.draft).toBe('Square')
  })

  it('shows the just-committed value immediately, even before the value prop catches up to it', () => {
    const { result, rerender } = renderHook<FieldEditState<string>, { value: string }>(
      ({ value }) => useSelectFieldEdit({ value, onCommit: vi.fn() }),
      { initialProps: { value: 'Contra' } },
    )

    act(() => result.current.onFocus())
    act(() => result.current.onChange('Square'))

    rerender({ value: 'Contra' }) // still stale, simulating the async write's gap
    expect(result.current.draft).toBe('Square')

    rerender({ value: 'Square' })
    expect(result.current.draft).toBe('Square')
  })

  it('shows a just-committed null immediately, for a field where null is itself a legitimate value', () => {
    const { result, rerender } = renderHook<FieldEditState<string | null>, { value: string | null }>(
      ({ value }) => useSelectFieldEdit({ value, onCommit: vi.fn() }),
      { initialProps: { value: 'Contra' } },
    )

    act(() => result.current.onFocus())
    act(() => result.current.onChange(null))

    rerender({ value: 'Contra' })
    expect(result.current.draft).toBeNull()
  })

  it('closes without committing on blur, e.g. when the picker is dismissed without a new value chosen', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSelectFieldEdit({ value: 'Contra', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.onBlur())

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.isFocused).toBe(false)
    expect(result.current.draft).toBe('Contra')
  })
})
