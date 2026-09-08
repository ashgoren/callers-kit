import { Fragment, useState } from 'react'
import { useTable } from '@tanstack/react-table'
import type { ColumnVisibilityState, SortingState } from '@tanstack/react-table'
import { ArrowDown, ArrowUp } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { columns, danceFields, features } from './DancesPage.columns'
import type { DanceWithJoins } from './DancesPage.columns'
import { useDances } from './DancesPage.data'

export function DancesPage() {
  const { dances, isLoading } = useDances()

  // Column layout will eventually persist to a synced user_table_preferences row.
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useTable({
    features,
    columns,
    data: dances,
    getRowId: (row) => row.id,
    state: { columnVisibility, sorting },
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    enableMultiSort: false, // single-column sort only
    enableSortingRemoval: true, // third click clears sort
    sortDescFirst: false, // first click sorts ascending
  })

  if (isLoading) {
    return <p className="text-muted-foreground p-4 text-center text-sm">Loading…</p>
  }

  return (
    <div className="p-4">
      {/* Tablet and up (640px+): full table */}
      <div className="hidden sm:block">
        <div className="mb-2 flex justify-end">
          <ColumnsMenu table={table} />
        </div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {/* The whole header is the sort toggle, not a separate icon */}
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="flex w-full items-center gap-1 text-left enabled:cursor-pointer disabled:cursor-default"
                        onClick={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                      >
                        <table.FlexRender header={header} />
                        {header.column.getIsSorted() === 'asc' && <ArrowUp className="size-3.5" />}
                        {header.column.getIsSorted() === 'desc' && <ArrowDown className="size-3.5" />}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {/* getVisibleCells, not getAllCells (which includes hidden columns) */}
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Phone (<640px): stacked cards */}
      <div className="sm:hidden">
        <MobileSortMenu table={table} />
        <ul className="space-y-2">
          {table.getRowModel().rows.map((row) => (
            <li key={row.id}>
              <DanceCard dance={row.original} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ColumnsMenu({ table }: { table: ReturnType<typeof useTable<typeof features, DanceWithJoins>> }) {
  const hideableColumns = table.getAllLeafColumns().filter((column) => column.getCanHide())

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-md border px-2 py-1 text-sm hover:bg-muted">
        Columns
      </DropdownMenuTrigger>
      {/* w-56 overrides the default w-(--anchor-width) */}
      <DropdownMenuContent align="end" className="w-56">
        {hideableColumns.map((column) => {
          // Reads the label from danceFields rather than column.columnDef.header.
          const field = danceFields.find((danceField) => danceField.key === column.id)

          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(checked) => {
                column.toggleVisibility(checked)
              }}
            >
              {field?.label ?? column.id}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Phone's substitute for clicking a table header directly - a field picker
// plus a separate direction toggle, since there's no header here to click.
// Both act through the same table.setSorting(...) the desktop header uses,
// so this is just a second way to drive the identical, single sort state.
function MobileSortMenu({ table }: { table: ReturnType<typeof useTable<typeof features, DanceWithJoins>> }) {
  const sortableColumns = table.getAllLeafColumns().filter((column) => column.getCanSort())
  const currentSort = table.state.sorting[0]
  const currentField = currentSort ? danceFields.find((field) => field.key === currentSort.id) : undefined

  return (
    <div className="mb-2 flex items-center justify-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-md border px-2 py-1 text-sm hover:bg-muted">
          {currentField ? `Sort: ${currentField.label}` : 'Sort'}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuRadioGroup
            value={currentSort?.id ?? ''}
            onValueChange={(value: string) => {
              // Always resets to ascending on a field change - matching the
              // desktop header's own first-click direction (sortDescFirst:
              // false above), not whatever direction this field was left at
              // the last time it happened to be sorted.
              table.setSorting([{ id: value, desc: false }])
            }}
          >
            {sortableColumns.map((column) => {
              const field = danceFields.find((danceField) => danceField.key === column.id)

              return (
                <DropdownMenuRadioItem key={column.id} value={column.id}>
                  {field?.label ?? column.id}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        className="rounded-md border p-1 enabled:hover:bg-muted disabled:opacity-50"
        disabled={!currentSort}
        onClick={() => {
          if (!currentSort) return
          table.setSorting([{ id: currentSort.id, desc: !currentSort.desc }])
        }}
        aria-label={currentSort?.desc ? 'Sort descending' : 'Sort ascending'}
      >
        {currentSort?.desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
      </button>
    </div>
  )
}

// Derives its fields from the same danceFields array the table columns use.
// We override the title field display and filter it out of the generic loop.
function DanceCard({ dance }: { dance: DanceWithJoins }) {
  const titleField = danceFields.find((field) => field.key === 'title')!

  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">{titleField.render(dance.title)}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {danceFields
          .filter((field) => field.key !== 'title')
          .map((field) => (
            <Fragment key={field.key}>
              <dt className="text-muted-foreground">{field.label}</dt>
              {/* min-w-0 so the value can shrink to fit the card's width, so truncate works */}
              <dd className="min-w-0">{(field.cardRender ?? field.render)(dance[field.key])}</dd>
            </Fragment>
          ))}
      </dl>
    </div>
  )
}
