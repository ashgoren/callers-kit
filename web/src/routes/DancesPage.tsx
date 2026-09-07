import { useTable } from '@tanstack/react-table'
import { useQuery } from '@powersync/react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { columns, features, formatDate, formatFormation } from './DancesPage.columns'
import type { Dance } from '@/lib/powersync/schema'

export function DancesPage() {
  // Reactive: auto re-runs & re-renders whenever local SQLite `dances` table changes
  const { data: dances, isLoading } = useQuery<Dance>(
    'SELECT id, title, difficulty, formation, notes, created_at, updated_at FROM dances',
  )

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
      {/* Desktop/tablet-landscape (1024px+): full table. */}
      <div className="hidden lg:block">
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

      {/* Mobile/tablet-portrait (<1024px): stacked cards. */}
      <ul className="space-y-2 lg:hidden">
        {dances.map((dance) => (
          <li key={dance.id}>
            <DanceCard dance={dance} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function DanceCard({ dance }: { dance: Dance }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">
        {dance.title || <span className="text-muted-foreground">Untitled</span>}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Difficulty</dt>
        <dd>{dance.difficulty ?? '—'}</dd>
        <dt className="text-muted-foreground">Formation</dt>
        <dd>{formatFormation(dance.formation)}</dd>
        <dt className="text-muted-foreground">Notes</dt>
        <dd className="truncate" title={dance.notes ?? undefined}>
          {dance.notes ?? '—'}
        </dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd>{formatDate(dance.created_at)}</dd>
        <dt className="text-muted-foreground">Updated</dt>
        <dd>{formatDate(dance.updated_at)}</dd>
      </dl>
    </div>
  )
}
