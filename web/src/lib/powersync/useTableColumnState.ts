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
// `override` gives an edit instant local feedback rather than waiting on
// `useQuery`'s watched-query debounce to catch up - without it, rapid
// changes (dragging to resize, clicking several visibility toggles) could
// visibly lag. It's cleared again as soon as the synced row matches it (a
// local SQLite read of our own write, so this happens almost immediately
// regardless of network state), at which point `state` goes back to
// tracking `row` live. Two devices editing at the exact same moment aren't
// specially reconciled - only one write wins.
export function useTableColumnState(tableName: string, defaults: TableColumnState) {
  const { data, isLoading } = useQuery<PreferencesRow>(
    'SELECT id, column_state FROM user_table_preferences WHERE table_name = ?',
    [tableName],
  )
  const row = data[0]
  const rowState = parseColumnState(row, defaults)

  const [override, setOverride] = useState<TableColumnState | null>(null)

  // Clears the override as soon as the synced row matches it.
  if (override && JSON.stringify(rowState) === JSON.stringify(override)) setOverride(null)

  const state = override ?? rowState

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
    resetToDefaults: () => commit(defaults),
  }
}
