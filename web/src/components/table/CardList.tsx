import { ArrowDown, ArrowUp } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { ReactNode } from 'react'
import type { RowData } from '@tanstack/react-table'
import type { TableInstance } from './tableInstance'

// The phone-width fallback for an entity table: a sort menu (this table's
// substitute for sort-by-clicking-a-column-header) plus one card per row,
// rendered however the caller's renderCard sees fit for that entity.
export function CardList<TRow extends RowData>({ table, renderCard }: {
  table: TableInstance<TRow>
  renderCard: (row: TRow) => ReactNode
}) {
  return (
    <>
      <CardListSortMenu table={table} />
      <ul className="space-y-2">
        {table.getRowModel().rows.map((row) => (
          <li key={row.id}>{renderCard(row.original)}</li>
        ))}
      </ul>
    </>
  )
}

// Card list's substitute for sort-by-clicking-table-header, uses same table.setSorting.
function CardListSortMenu<TRow extends RowData>({ table }: { table: TableInstance<TRow> }) {
  const sortableColumns = table.getAllLeafColumns().filter((column) => column.getCanSort())
  const currentSort = table.state.sorting[0]
  const currentColumn = currentSort ? table.getColumn(currentSort.id) : undefined
  const currentLabel = columnLabel(currentColumn)

  return (
    <div className="mb-2 flex items-center justify-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-md border px-2 py-1 text-sm hover:bg-muted">
          {currentLabel ? `Sort: ${currentLabel}` : 'Sort'}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuRadioGroup
            value={currentSort?.id ?? ''}
            // Reset to ascending on a field change
            onValueChange={(value: string) => table.setSorting([{ id: value, desc: false }])}
          >
            {sortableColumns.map((column) => (
              <DropdownMenuRadioItem key={column.id} value={column.id}>
                {columnLabel(column) ?? column.id}
              </DropdownMenuRadioItem>
            ))}
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

// header is typed as string | ((context) => ReactNode); every column in this
// app sets it to a plain label string, so fall back to undefined only if
// that assumption is ever broken by a template header.
function columnLabel(column: { columnDef: { header?: unknown } } | undefined): string | undefined {
  const header = column?.columnDef.header
  return typeof header === 'string' ? header : undefined
}
