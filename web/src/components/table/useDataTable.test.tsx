import { act, renderHook } from '@testing-library/react'
import { createColumnHelper } from '@tanstack/react-table'
import { describe, expect, it, vi } from 'vitest'
import { dataTableFeatures } from './tableInstance'
import { useDataTable } from './useDataTable'
import type { useTableColumnState } from '@/lib/powersync/useTableColumnState'
import type { TableColumnState } from '@/lib/powersync/tablePreferences'

const { useTableColumnStateMock } = vi.hoisted(() => ({ useTableColumnStateMock: vi.fn() }))

vi.mock('@/lib/powersync/useTableColumnState', () => ({
  useTableColumnState: useTableColumnStateMock,
}))

interface Row {
  id: string
  name: string
}

const columnHelper = createColumnHelper<typeof dataTableFeatures, Row>()
const columns = columnHelper.columns([columnHelper.accessor('name', { id: 'name', header: 'Name' })])

const defaultColumnState: TableColumnState = {
  columnVisibility: {},
  sorting: [{ id: 'name', desc: false }],
  columnPinning: { start: [], end: [] },
  columnOrder: [],
  columnSizing: {},
}

const data: Row[] = [
  { id: '1', name: 'Bravo' },
  { id: '2', name: 'Alpha' },
]

// Stands in for useTableColumnState's real return shape - useDataTable's own
// tests care only about how it wires that shape into useTable, not about
// useTableColumnState's internal sync/override behavior (covered by that
// hook's own tests).
function mockColumnState(overrides: Partial<ReturnType<typeof useTableColumnState>> = {}) {
  const mocked = {
    state: defaultColumnState,
    isLoading: false,
    setColumnVisibility: vi.fn(),
    setSorting: vi.fn(),
    setColumnPinning: vi.fn(),
    setColumnOrder: vi.fn(),
    setColumnSizing: vi.fn(),
    resetToDefaults: vi.fn(),
    ...overrides,
  }
  useTableColumnStateMock.mockReturnValue(mocked)
  return mocked
}

describe('useDataTable', () => {
  it('passes tableName and defaultColumnState through to useTableColumnState', () => {
    mockColumnState()

    renderHook(() => useDataTable({ tableName: 'programs', columns, data, defaultColumnState }))

    expect(useTableColumnStateMock).toHaveBeenCalledWith('programs', defaultColumnState)
  })

  it('builds a table instance from the given columns and data, with rows keyed by id', () => {
    mockColumnState()

    const { result } = renderHook(() => useDataTable({ tableName: 'dances', columns, data, defaultColumnState }))

    // Sorted ascending by name (the default sorting state below), not
    // insertion order - 'Alpha' (id 2) before 'Bravo' (id 1) - confirming
    // getRowId is wired to row.id rather than row index.
    expect(result.current.table.getRowModel().rows.map((row) => row.id)).toEqual(['2', '1'])
  })

  it('reflects the synced sorting/visibility/pinning/order state onto the table', () => {
    mockColumnState({
      state: {
        ...defaultColumnState,
        sorting: [{ id: 'name', desc: true }],
        columnPinning: { start: ['name'], end: [] },
      },
    })

    const { result } = renderHook(() => useDataTable({ tableName: 'dances', columns, data, defaultColumnState }))

    expect(result.current.table.state.sorting).toEqual([{ id: 'name', desc: true }])
    expect(result.current.table.state.columnPinning).toEqual({ start: ['name'], end: [] })
  })

  it('routes a sorting change through to the synced setSorting setter rather than local table state', () => {
    const mocked = mockColumnState()

    const { result } = renderHook(() => useDataTable({ tableName: 'dances', columns, data, defaultColumnState }))
    act(() => {
      result.current.table.setSorting([{ id: 'name', desc: true }])
    })

    expect(mocked.setSorting).toHaveBeenCalled()
  })

  it('leaves columnSizing out of the table’s own controlled state, returning it separately for ColumnSizingSync to bridge', () => {
    const mocked = mockColumnState({ state: { ...defaultColumnState, columnSizing: { name: 250 } } })

    const { result } = renderHook(() => useDataTable({ tableName: 'dances', columns, data, defaultColumnState }))

    expect(result.current.columnSizing).toEqual({ name: 250 })
    expect(result.current.setColumnSizing).toBe(mocked.setColumnSizing)
    // Not wired into the table's own controlled state - see useDataTable.ts.
    expect(result.current.table.state.columnSizing).toEqual({})
  })

  it('exposes isLoading from useTableColumnState and resetColumns as resetToDefaults', () => {
    const mocked = mockColumnState({ isLoading: true })

    const { result } = renderHook(() => useDataTable({ tableName: 'dances', columns, data, defaultColumnState }))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.resetColumns).toBe(mocked.resetToDefaults)
  })
})
