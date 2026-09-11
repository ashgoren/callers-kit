import { useState } from 'react'
import { useQuery } from '@powersync/react'
import { parseColumnState, resolveUpdater, writeColumnState } from './tablePreferences'
import type { PreferencesRow, TableColumnState } from './tablePreferences'
import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
  SortingState,
  Updater,
} from '@tanstack/react-table'

// Reads (and writes through to) this user's saved column layout for one
// table, so sort/visibility/pinning/order survive a reload and follow the
// user across devices instead of resetting to defaults every time.
//
// Before this session's first edit, `state` tracks the synced row directly.
// Upon first edit, `override` takes over as a frozen local snapshot and stays
// authoritative for the rest of the session. A remote change from another device
// takes effect on this table's next full remount (e.g. a page reload), not live.
export function useTableColumnState(tableName: string, defaults: TableColumnState) {
  const { data, isLoading } = useQuery<PreferencesRow>(
    'SELECT id, column_state FROM user_table_preferences WHERE table_name = ?',
    [tableName],
  )
  const row = data[0]

  const [override, setOverride] = useState<TableColumnState | null>(null)
  const state = override ?? parseColumnState(row, defaults)

  // Each setter merges its own field into the current full state and
  // writes the whole thing back - column_state is one JSON blob per row.
  function commit(patch: Partial<TableColumnState>) {
    const next = { ...state, ...patch }
    setOverride(next)
    if (row) void writeColumnState(row.id, next)
  }

  return {
    state,
    isLoading,
    setColumnVisibility: (updater: Updater<ColumnVisibilityState>) =>
      commit({ columnVisibility: resolveUpdater(updater, state.columnVisibility) }),
    setSorting: (updater: Updater<SortingState>) => commit({ sorting: resolveUpdater(updater, state.sorting) }),
    setColumnPinning: (updater: Updater<ColumnPinningState>) =>
      commit({ columnPinning: resolveUpdater(updater, state.columnPinning) }),
    setColumnOrder: (updater: Updater<ColumnOrderState>) =>
      commit({ columnOrder: resolveUpdater(updater, state.columnOrder) }),
    setColumnSizing: (updater: Updater<ColumnSizingState>) =>
      commit({ columnSizing: resolveUpdater(updater, state.columnSizing) }),
  }
}
