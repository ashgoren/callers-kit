import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useOptimisticValue } from './useOptimisticValue'

describe('useOptimisticValue', () => {
  it('shows the real value with no override set', () => {
    const { result } = renderHook(({ value }) => useOptimisticValue(value), { initialProps: { value: 'a' } })

    expect(result.current[0]).toBe('a')
  })

  it('shows an override immediately, even while the real value prop stays stale', () => {
    const { result, rerender } = renderHook(({ value }) => useOptimisticValue(value), { initialProps: { value: 'a' } })

    act(() => {
      result.current[1]('b')
    })
    expect(result.current[0]).toBe('b')

    // Same still-stale prop (the commit still in flight) keeps showing the
    // override rather than reverting.
    rerender({ value: 'a' })
    expect(result.current[0]).toBe('b')
  })

  it('clears the override once the real value actually catches up with it', () => {
    const { result, rerender } = renderHook(({ value }) => useOptimisticValue(value), { initialProps: { value: 'a' } })

    act(() => {
      result.current[1]('b')
    })
    rerender({ value: 'b' })

    // Proven by then changing the real value again and confirming that's
    // what shows, rather than a stale override from before.
    rerender({ value: 'c' })
    expect(result.current[0]).toBe('c')
  })

  it('clears an array override by structural equality by default, not by reference', () => {
    // The realistic case this whole hook exists for: a PowerSync commit
    // followed by a freshly-decoded array from the reactive query - never
    // the same reference as what was set, even once it represents the same
    // data. If this compared by reference instead, the override would never
    // clear at all.
    const { result, rerender } = renderHook(({ value }) => useOptimisticValue(value), {
      initialProps: { value: [1, 2] as number[] },
    })

    act(() => {
      result.current[1]([1, 2, 3])
    })
    rerender({ value: [1, 2, 3] }) // a different reference, same contents

    // Proven by then changing the real value again and confirming that's
    // what shows, rather than a stale override from before.
    rerender({ value: [4, 5] })
    expect(result.current[0]).toEqual([4, 5])
  })

  it('uses a custom equality check when one is passed, instead of the default structural comparison', () => {
    // A deliberately loose comparator (case-insensitive) to prove the
    // parameter is actually used, not just present in the signature.
    const { result, rerender } = renderHook(
      ({ value }) => useOptimisticValue(value, (a, b) => a.toLowerCase() === b.toLowerCase()),
      { initialProps: { value: 'a' } },
    )

    act(() => {
      result.current[1]('B')
    })
    rerender({ value: 'b' }) // differs only in case from the override - still counts as a match

    rerender({ value: 'c' })
    expect(result.current[0]).toBe('c')
  })
})
