import { useTable } from '@tanstack/react-table'
import { useTableColumnState } from '@/lib/powersync/useTableColumnState'
import { dataTableFeatures } from './tableInstance'
import type { RowData } from '@tanstack/react-table'
import type { TableColumnState } from '@/lib/powersync/tablePreferences'

type DataTableOptions<TRow extends RowData> = Parameters<typeof useTable<typeof dataTableFeatures, TRow>>[0]

// Wires a synced user_table_preferences row (sort/visibility/pinning/order/
// sizing) into a TanStack table instance - the shape every entity table in
// this app needs, so each page only supplies what's actually its own: which
// table's preferences to sync, its column defs, and its row data.
//
// columnSizing is deliberately left out of the table's own controlled state
// here - including it would make TanStack treat it as controlled, committing
// to the local db on every pixel of drag movement instead of once a drag
// finishes. ColumnSizingSync bridges it to the synced value separately -
// callers render that themselves using the columnSizing/setColumnSizing
// returned below, since it also needs to be mounted in the tree.
export function useDataTable<TRow extends RowData & { id: string }>({
  tableName,
  columns,
  data,
  defaultColumnState,
}: {
  tableName: string
  columns: DataTableOptions<TRow>['columns']
  data: DataTableOptions<TRow>['data']
  defaultColumnState: TableColumnState
}) {
  const {
    state,
    isLoading,
    setColumnVisibility,
    setSorting,
    setColumnPinning,
    setColumnOrder,
    setColumnSizing,
    resetToDefaults,
  } = useTableColumnState(tableName, defaultColumnState)

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (row) => row.id,
    state: {
      columnVisibility: state.columnVisibility,
      sorting: state.sorting,
      columnPinning: state.columnPinning,
      columnOrder: state.columnOrder,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    onColumnPinningChange: setColumnPinning,
    onColumnOrderChange: setColumnOrder,
    enableMultiSort: false, // single-column sort only
    enableSortingRemoval: false, // no unsorted state - clicking a header just toggles asc/desc
    sortDescFirst: false, // first click sorts ascending
    defaultColumn: { size: 150, minSize: 25, maxSize: 400 },
    columnResizeMode: 'onChange', // live width updates while dragging
  })

  return {
    table,
    isLoading,
    resetColumns: resetToDefaults,
    columnSizing: state.columnSizing,
    setColumnSizing,
  }
}
