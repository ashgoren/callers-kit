import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './database' // Actually loads the mock below, not the real module.
import { useTableColumnState } from './useTableColumnState'
import type { TableColumnState } from './tablePreferences'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))

vi.mock('@powersync/react', () => ({
  useQuery: useQueryMock,
}))

vi.mock('./database', () => ({
  db: { execute: vi.fn() },
}))

const defaults: TableColumnState = {
  columnVisibility: {},
  sorting: [{ id: 'title', desc: false }],
  columnPinning: { start: ['title'], end: [] },
  columnOrder: [],
  columnSizing: {},
}

describe('useTableColumnState', () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockClear()
  })

  it('queries by the given table name, and returns the defaults with isLoading true while in flight', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: true })

    const { result } = renderHook(() => useTableColumnState('dances', defaults))

    expect(useQueryMock).toHaveBeenCalledWith(
      'SELECT id, column_state FROM user_table_preferences WHERE table_name = ?',
      ['dances'],
    )
    expect(result.current.state).toEqual(defaults)
    expect(result.current.isLoading).toBe(true)
  })

  it('returns a stored row merged over the defaults once loaded', () => {
    useQueryMock.mockReturnValue({
      data: [{ id: '1', column_state: JSON.stringify({ columnOrder: ['notes', 'title'] }) }],
      isLoading: false,
    })

    const { result } = renderHook(() => useTableColumnState('dances', defaults))

    expect(result.current.state).toEqual({ ...defaults, columnOrder: ['notes', 'title'] })
    expect(result.current.isLoading).toBe(false)
  })

  it('updates the loaded row by id, merging just the one changed field into the full stored state', () => {
    useQueryMock.mockReturnValue({
      data: [{ id: '42', column_state: JSON.stringify({ columnOrder: ['notes', 'title'] }) }],
      isLoading: false,
    })
    const { result } = renderHook(() => useTableColumnState('dances', defaults))

    act(() => {
      result.current.setColumnVisibility({ notes: false })
    })

    expect(db.execute).toHaveBeenCalledWith('UPDATE user_table_preferences SET column_state = ? WHERE id = ?', [
      JSON.stringify({ ...defaults, columnOrder: ['notes', 'title'], columnVisibility: { notes: false } }),
      '42',
    ])
  })

  it('resolves a function updater against the current merged state before writing it', () => {
    useQueryMock.mockReturnValue({
      data: [{ id: '42', column_state: JSON.stringify({ columnPinning: { start: ['title'], end: [] } }) }],
      isLoading: false,
    })
    const { result } = renderHook(() => useTableColumnState('dances', defaults))

    act(() => {
      result.current.setColumnPinning((old) => ({ ...old, start: [...old.start, 'notes'] }))
    })

    expect(db.execute).toHaveBeenCalledWith('UPDATE user_table_preferences SET column_state = ? WHERE id = ?', [
      JSON.stringify({ ...defaults, columnPinning: { start: ['title', 'notes'], end: [] } }),
      '42',
    ])
  })

  it('writes columnSizing via setColumnSizing, the same way as the other four fields', () => {
    // This setter isn't meant to be wired as onColumnSizingChange directly
    // (see useTableColumnState.ts) - only that it persists correctly when
    // called is this test's concern, not how/when a caller invokes it.
    useQueryMock.mockReturnValue({ data: [{ id: '42', column_state: '{}' }], isLoading: false })
    const { result } = renderHook(() => useTableColumnState('dances', defaults))

    act(() => {
      result.current.setColumnSizing({ title: 300 })
    })

    expect(db.execute).toHaveBeenCalledWith('UPDATE user_table_preferences SET column_state = ? WHERE id = ?', [
      JSON.stringify({ ...defaults, columnSizing: { title: 300 } }),
      '42',
    ])
  })

  it('does not attempt to write when no row has loaded yet (defensive - every user has one from signup, so this should not happen in practice)', () => {
    useQueryMock.mockReturnValue({ data: [], isLoading: false })
    const { result } = renderHook(() => useTableColumnState('dances', defaults))

    act(() => {
      result.current.setSorting([{ id: 'difficulty', desc: true }])
    })

    expect(db.execute).not.toHaveBeenCalled()
    // Local state still updates even though nothing persisted, so the UI
    // doesn't silently ignore the interaction.
    expect(result.current.state.sorting).toEqual([{ id: 'difficulty', desc: true }])
  })

  it('keeps the locally edited state even if the query result changes on a later render (e.g. its own write echoing back)', () => {
    useQueryMock.mockReturnValue({ data: [{ id: '1', column_state: '{}' }], isLoading: false })
    const { result, rerender } = renderHook(() => useTableColumnState('dances', defaults))

    act(() => {
      result.current.setSorting([{ id: 'difficulty', desc: true }])
    })
    expect(result.current.state.sorting).toEqual([{ id: 'difficulty', desc: true }])

    // Simulates the reactive query catching up with a row that (for
    // whatever reason - a stale/partial echo, a slow requery) doesn't yet
    // match what was just written locally.
    useQueryMock.mockReturnValue({
      data: [{ id: '1', column_state: JSON.stringify(defaults) }],
      isLoading: false,
    })
    rerender()

    expect(result.current.state.sorting).toEqual([{ id: 'difficulty', desc: true }])
  })
})
