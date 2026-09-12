import { useTable } from '@tanstack/react-table'
import { Spinner } from '@/components/ui/spinner'
import { useTableColumnState } from '@/lib/powersync/useTableColumnState'
import { useDances } from './DancesPage.data'
import { columns, DEFAULT_COLUMN_STATE, features } from './DancesPage.columns'
import { TableView } from './DancesPage.TableView'
import { CardList } from './DancesPage.CardList'
import { ColumnSizingSync } from './DancesPage.ColumnSizingSync'

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
  } = useTableColumnState('dances', DEFAULT_COLUMN_STATE)

  const table = useTable({
    features,
    columns,
    data: dances,
    getRowId: (row) => row.id,
    // columnSizing is deliberately left out here - including it would make
    // TanStack treat it as controlled, committing to the local db on every
    // pixel of drag movement instead of once a drag finishes. ColumnSizingSync
    // below bridges it to the synced value separately - see that file.
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
    defaultColumn: { size: 150, minSize: 80, maxSize: 400 },
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
        <TableView table={table} />
      </div>

      {/* Phone (<640px): stacked cards */}
      <div className="sm:hidden">
        <CardList table={table} />
      </div>
    </div>
  )
}
