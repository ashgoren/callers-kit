import { Fragment } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { danceFields, getDanceField } from './DancesPage.columns'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { DanceWithJoins, TableInstance } from './DancesPage.columns'

export function CardList({ table }: { table: TableInstance }) {
  return (
    <>
      <CardListSortMenu table={table} />
      <ul className="space-y-2">
        {table.getRowModel().rows.map((row) => (
          <li key={row.id}>
            <DanceCard dance={row.original} />
          </li>
        ))}
      </ul>
    </>
  )
}

// Card list's substitute for sort-by-clicking-table-header, uses same table.setSorting.
function CardListSortMenu({ table }: { table: TableInstance }) {
  const sortableColumns = table.getAllLeafColumns().filter((column) => column.getCanSort())
  const currentSort = table.state.sorting[0]
  const currentField = currentSort ? getDanceField(currentSort.id) : undefined

  return (
    <div className="mb-2 flex items-center justify-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-md border px-2 py-1 text-sm hover:bg-muted">
          {currentField ? `Sort: ${currentField.label}` : 'Sort'}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuRadioGroup
            value={currentSort?.id ?? ''}
            // Reset to ascending on a field change
            onValueChange={(value: string) => table.setSorting([{ id: value, desc: false }])}
          >
            {sortableColumns.map((column) => {
              const field = getDanceField(column.id)

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
function DanceCard({ dance }: { dance: DanceWithJoins }) {
  const titleField = getDanceField('title')!

  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">{titleField.render(dance.title)}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {danceFields
          .filter((field) => field.key !== 'title')
          .map((field) => (
            <Fragment key={field.key}>
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd className="min-w-0">{(field.cardRender ?? field.render)(dance[field.key])}</dd>
            </Fragment>
          ))}
      </dl>
    </div>
  )
}
