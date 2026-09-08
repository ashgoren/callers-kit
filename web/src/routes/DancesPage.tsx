import { Fragment } from 'react'
import { useTable } from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { columns, danceFields, features } from './DancesPage.columns'
import type { DanceWithJoins } from './DancesPage.columns'
import { useDances } from './DancesPage.data'

export function DancesPage() {
  const { dances, isLoading } = useDances()

  const table = useTable({
    features,
    columns,
    data: dances,
    getRowId: (row) => row.id,
  })

  if (isLoading) {
    return <p className="text-muted-foreground p-4 text-center text-sm">Loading…</p>
  }

  return (
    <div className="p-4">
      {/* Tablet and up (640px+): full table */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
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
      <ul className="space-y-2 sm:hidden">
        {dances.map((dance) => (
          <li key={dance.id}>
            <DanceCard dance={dance} />
          </li>
        ))}
      </ul>
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
