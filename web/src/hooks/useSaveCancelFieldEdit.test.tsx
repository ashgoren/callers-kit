import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSaveCancelFieldEdit } from './useSaveCancelFieldEdit'
import type { KeyboardEvent } from 'react'
import type { FieldEditState } from '@/components/fields/InlineEditableField'

// onKeyDown here only ever inspects whether a discard warning is armed, not
// the key itself, so a plain stand-in event is enough to exercise it.
const IGNORED_KEY_EVENT = {} as unknown as KeyboardEvent

describe('useSaveCancelFieldEdit', () => {
  it('starts with draft equal to the given value, unfocused, no error', () => {
    const { result } = renderHook(() => useSaveCancelFieldEdit({ value: '<p>Hi</p>', onCommit: vi.fn() }))

    expect(result.current.draft).toBe('<p>Hi</p>')
    expect(result.current.isFocused).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('activates on focus', () => {
    const { result } = renderHook(() => useSaveCancelFieldEdit({ value: '<p>Hi</p>', onCommit: vi.fn() }))

    act(() => result.current.onFocus())

    expect(result.current.isFocused).toBe(true)
  })

  it('commits on change (Save), and closes', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSaveCancelFieldEdit<string>({ value: '<p>Hi</p>', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.onChange('<p>Hi there</p>'))

    expect(onCommit).toHaveBeenCalledWith('<p>Hi there</p>')
    expect(result.current.isFocused).toBe(false)
  })

  it('does not call onCommit when the value passed to onChange is unchanged, but still closes', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSaveCancelFieldEdit({ value: '<p>Hi</p>', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.onChange('<p>Hi</p>'))

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.isFocused).toBe(false)
  })

  it('shows the just-committed value immediately, even before the value prop catches up to it', () => {
    const onCommit = vi.fn()
    const { result, rerender } = renderHook<FieldEditState<string>, { value: string }>(
      ({ value }) => useSaveCancelFieldEdit({ value, onCommit }),
      { initialProps: { value: '<p>Hi</p>' } },
    )

    act(() => result.current.onFocus())
    act(() => result.current.onChange('<p>Hi there</p>'))

    rerender({ value: '<p>Hi</p>' }) // still stale, simulating the async write's gap
    expect(result.current.draft).toBe('<p>Hi there</p>')

    rerender({ value: '<p>Hi there</p>' })
    expect(result.current.draft).toBe('<p>Hi there</p>')
  })

  it('shows a just-committed null immediately, for a field where null is itself a legitimate value', () => {
    const onCommit = vi.fn()
    const { result, rerender } = renderHook<FieldEditState<string | null>, { value: string | null }>(
      ({ value }) => useSaveCancelFieldEdit({ value, onCommit }),
      { initialProps: { value: '<p>Hi</p>' } },
    )

    act(() => result.current.onFocus())
    act(() => result.current.onChange(null))

    rerender({ value: '<p>Hi</p>' })
    expect(result.current.draft).toBeNull()
  })

  it('does nothing on blur - stays focused, no commit, no warning', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSaveCancelFieldEdit({ value: '<p>Hi</p>', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.onBlur())

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.isFocused).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('saveWithoutClosing commits like onChange, but stays focused', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSaveCancelFieldEdit<string>({ value: '<p>Hi</p>', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.saveWithoutClosing('<p>Hi there</p>'))

    expect(onCommit).toHaveBeenCalledWith('<p>Hi there</p>')
    expect(result.current.isFocused).toBe(true)
    expect(result.current.draft).toBe('<p>Hi there</p>')
  })

  it('saveWithoutClosing does not call onCommit when the checkpointed value is unchanged', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSaveCancelFieldEdit({ value: '<p>Hi</p>', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.saveWithoutClosing('<p>Hi</p>'))

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.isFocused).toBe(true)
  })

  it('saveWithoutClosing clears an armed discard warning, since the checkpoint now covers it', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSaveCancelFieldEdit({ value: '<p>Hi</p>', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.attemptCancel('<p>Hi there</p>'))
    expect(result.current.error).toBe('Discard your changes?')

    act(() => result.current.saveWithoutClosing('<p>Hi there</p>'))

    expect(onCommit).toHaveBeenCalledWith('<p>Hi there</p>')
    expect(result.current.error).toBeNull()
    expect(result.current.isFocused).toBe(true)
  })

  it('a later attemptCancel only compares against the last checkpoint, not the field\'s original value', () => {
    // Once saveWithoutClosing has committed a checkpoint, it's safely
    // persisted - Cancel/Escape after that point should only be able to
    // discard what's changed since, not revert past a save that already
    // happened, the same way saving partway through any other document
    // doesn't leave you able to undo past that save point.
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSaveCancelFieldEdit({ value: '<p>Hi</p>', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.saveWithoutClosing('<p>Hi there</p>'))
    act(() => result.current.attemptCancel('<p>Hi there</p>')) // matches the checkpoint, not the original value

    expect(result.current.isFocused).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('attemptCancel closes immediately with no warning when the current content is unchanged', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSaveCancelFieldEdit({ value: '<p>Hi</p>', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.attemptCancel('<p>Hi</p>'))

    expect(result.current.isFocused).toBe(false)
    expect(result.current.error).toBeNull()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('attemptCancel arms a discard warning on the first call when content has changed, without closing or committing', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSaveCancelFieldEdit({ value: '<p>Hi</p>', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.attemptCancel('<p>Hi there</p>'))

    expect(result.current.error).toBe('Discard your changes?')
    expect(result.current.isFocused).toBe(true)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('attemptCancel discards on a second call, closing without committing', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSaveCancelFieldEdit({ value: '<p>Hi</p>', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.attemptCancel('<p>Hi there</p>'))
    act(() => result.current.attemptCancel('<p>Hi there</p>'))

    expect(result.current.isFocused).toBe(false)
    expect(result.current.error).toBeNull()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('onKeyDown clears an already-armed discard warning, so continuing to type resumes editing', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSaveCancelFieldEdit({ value: '<p>Hi</p>', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.attemptCancel('<p>Hi there</p>'))
    expect(result.current.error).toBe('Discard your changes?')

    act(() => result.current.onKeyDown(IGNORED_KEY_EVENT))

    expect(result.current.error).toBeNull()
    expect(result.current.isFocused).toBe(true)
  })

  it('onKeyDown does nothing when no warning is armed', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSaveCancelFieldEdit({ value: '<p>Hi</p>', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.onKeyDown(IGNORED_KEY_EVENT))

    expect(result.current.error).toBeNull()
    expect(result.current.isFocused).toBe(true)
  })

  it('onChange (Save) clears an armed discard warning along with committing', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useSaveCancelFieldEdit({ value: '<p>Hi</p>', onCommit }))

    act(() => result.current.onFocus())
    act(() => result.current.attemptCancel('<p>Hi there</p>'))
    expect(result.current.error).toBe('Discard your changes?')

    act(() => result.current.onChange('<p>Hi there</p>'))

    expect(onCommit).toHaveBeenCalledWith('<p>Hi there</p>')
    expect(result.current.error).toBeNull()
    expect(result.current.isFocused).toBe(false)
  })
})
