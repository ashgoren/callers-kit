import { useTable } from '@tanstack/react-table'
import { ColumnSizingSync } from '@/components/table/ColumnSizingSync'
import { dataTableFeatures } from '@/components/table/tableInstance'
import { TableView } from '@/components/table/TableView'
import { Spinner } from '@/components/ui/spinner'
import { useTableColumnState } from '@/lib/powersync/useTableColumnState'
import { useDances } from './DancesPage.data'
import { columns, DEFAULT_COLUMN_STATE } from './DancesPage.columns'
import { CardList } from './DancesPage.CardList'

export function DancesPage() {
  const { dances, isLoading: dancesLoading } = useDances()
  const {
    state,
    isLoading: preferencesLoading,
    setColumnVisibility,
    setSorting,
    setColumnPinning,
    setColumnOrder,
    setColumnSizing,
    resetToDefaults,
  } = useTableColumnState('dances', DEFAULT_COLUMN_STATE)

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: dances,
    getRowId: (row) => row.id,
    state: {
      columnVisibility: state.columnVisibility,
      sorting: state.sorting,
      columnPinning: state.columnPinning,
      columnOrder: state.columnOrder,
      // columnSizing is handled elsewhere to avoid triggering local db updates on every drag
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

  if (dancesLoading || preferencesLoading) {
    return (
      <div className="p-4 text-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4">
      <ColumnSizingSync table={table} savedColumnSizing={state.columnSizing} setColumnSizing={setColumnSizing} />

      {/* Tablet and up (640px+): full table */}
      <div className="hidden sm:block">
        <TableView table={table} resetColumns={resetToDefaults} />
      </div>

      {/* Phone (<640px): stacked cards */}
      <div className="sm:hidden">
        <CardList table={table} />
      </div>
    </div>
  )
}
