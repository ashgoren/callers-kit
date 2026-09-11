import { useState } from 'react'
import { useTable } from '@tanstack/react-table'
import { Spinner } from '@/components/ui/spinner'
import { useDances } from './DancesPage.data'
import { columns, features } from './DancesPage.columns'
import { TableView } from './DancesPage.TableView'
import { CardList } from './DancesPage.CardList'
import type { ColumnOrderState, ColumnPinningState, ColumnVisibilityState, SortingState } from '@tanstack/react-table'

export function DancesPage() {
  const { dances, isLoading } = useDances()

  // Controlled state, so eventually it can be synced to db.
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([{ id: 'title', desc: false }])
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ start: ['title'], end: [] })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]) // defaults to order columns were defined in

  const table = useTable({
    features,
    columns,
    data: dances,
    getRowId: (row) => row.id,
    state: { columnVisibility, sorting, columnPinning, columnOrder },
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

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4">
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
