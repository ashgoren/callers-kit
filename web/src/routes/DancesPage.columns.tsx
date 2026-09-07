import { createColumnHelper, tableFeatures } from '@tanstack/react-table'
import { format } from 'date-fns'
import type { Dance } from '@/lib/powersync/schema'

export function formatDate(value: string | null): string {
  return value ? format(new Date(value), 'M/d/yy') : '—'
}

export function formatFormation(value: string | null): string {
  return value ? value.replace(/^Duple Minor - /, '') : '—'
}

// Empty for now — no sort/filter/paginate/reorder/etc. yet (that's a later
// phase), and TanStack Table v9 only installs a feature's state/APIs once
// it's actually registered here, so an empty registration is the correct
// minimal table for a plain read-only render, not a placeholder to fill in.
export const features = tableFeatures({})

const columnHelper = createColumnHelper<typeof features, Dance>()

export const columns = columnHelper.columns([
  columnHelper.accessor('title', {
    header: 'Title',
    cell: (info) => info.getValue() || <span className="text-muted-foreground">Untitled</span>,
  }),
  columnHelper.accessor('difficulty', {
    header: 'Difficulty',
    cell: (info) => info.getValue() ?? '—',
  }),
  columnHelper.accessor('formation', {
    header: 'Formation',
    cell: (info) => formatFormation(info.getValue()),
  }),
  columnHelper.accessor('notes', {
    header: 'Notes',
    cell: (info) => {
      const notes = info.getValue()
      return notes ? (
        <span className="block max-w-xs truncate" title={notes}>
          {notes}
        </span>
      ) : (
        '—'
      )
    },
  }),
  columnHelper.accessor('created_at', {
    header: 'Created',
    cell: (info) => formatDate(info.getValue()),
  }),
  columnHelper.accessor('updated_at', {
    header: 'Updated',
    cell: (info) => formatDate(info.getValue()),
  }),
])
