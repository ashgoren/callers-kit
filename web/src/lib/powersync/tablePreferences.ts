import { db } from './database'
import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
  SortingState,
  Updater,
} from '@tanstack/react-table'

// The shape stored as JSON in a user_table_preferences row's column_state column.
export interface TableColumnState {
  columnVisibility: ColumnVisibilityState
  sorting: SortingState
  columnPinning: ColumnPinningState
  columnOrder: ColumnOrderState
  columnSizing: ColumnSizingState
}

// The subset of a user_table_preferences row this module actually reads/writes.
export interface PreferencesRow {
  id: string
  column_state: string
}

// Merges a stored row's column_state JSON with the defaults for any unset rows.
export function parseColumnState(row: PreferencesRow | undefined, defaults: TableColumnState): TableColumnState {
  if (!row) return defaults
  let stored: Partial<TableColumnState>
  try {
    stored = JSON.parse(row.column_state) as Partial<TableColumnState>
  } catch {
    // A corrupt value arriving via sync-down shouldn't take the table down with it.
    return defaults
  }
  return {
    columnVisibility: stored.columnVisibility ?? defaults.columnVisibility,
    sorting: stored.sorting ?? defaults.sorting,
    columnPinning: stored.columnPinning ?? defaults.columnPinning,
    columnOrder: stored.columnOrder ?? defaults.columnOrder,
    columnSizing: stored.columnSizing ?? defaults.columnSizing,
  }
}

// Resolves TanStack's updater-or-value callback shape (the same shape every
// on*Change table callback receives) against a known current value.
export function resolveUpdater<T>(updater: Updater<T>, current: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(current) : updater
}

// Single chokepoint for writing a table's column layout to the local PowerSync db.
export async function writeColumnState(id: string, next: TableColumnState): Promise<void> {
  await db.execute('UPDATE user_table_preferences SET column_state = ? WHERE id = ?', [JSON.stringify(next), id])
}
