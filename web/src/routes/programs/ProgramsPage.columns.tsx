import { sortFn_alphanumeric, sortFn_basic } from '@tanstack/react-table'
import { buildColumns, makeFieldDefiner } from '@/components/table/fieldColumns'
import { formatDate, mutedPlaceholder } from '@/lib/format'
import type { ReactNode } from 'react'
import type { LeafHeader as GenericLeafHeader, TableInstance as GenericTableInstance } from '@/components/table/tableInstance'
import type { Program } from '@/lib/powersync/schema'
import type { TableColumnState } from '@/lib/powersync/tablePreferences'

export interface ProgramDance {
  // The programs_dances junction row's own id - not dances.id. Named
  // distinctly from `id` so it can't be misread as the dance's own identity.
  programDanceId: string
  order: number
  title: string
}

export interface ProgramWithJoins extends Program {
  dances: ProgramDance[]
}

// Table view: a compact, wrapping row of numbered chips
function renderDanceChips(value: ProgramDance[]): ReactNode {
  if (value.length === 0) return mutedPlaceholder
  return (
    <div className="flex flex-wrap gap-1">
      {value.map((dance) => (
        <span key={dance.programDanceId} className="rounded-full border bg-muted px-2 py-0.5 text-xs whitespace-nowrap">
          {dance.order}. {dance.title}
        </span>
      ))}
    </div>
  )
}

// Card view: full untruncated numbered list, one dance per line
function cardRenderDanceList(value: ProgramDance[]): ReactNode {
  if (value.length === 0) return mutedPlaceholder
  return (
    <ol className="space-y-0.5">
      {value.map((dance) => (
        <li key={dance.programDanceId}>
          {dance.order}. {dance.title}
        </li>
      ))}
    </ol>
  )
}

const defineField = makeFieldDefiner<ProgramWithJoins>()

export const programFields = [
  defineField({
    key: 'date',
    label: 'Date',
    render: (value) => (value === null ? mutedPlaceholder : formatDate(value)),
    sortFn: sortFn_basic, // sorts by raw ISO date string
    size: 105,
  }),
  defineField({
    key: 'location',
    label: 'Location',
    render: (value) => value || mutedPlaceholder,
    sortValue: (value) => value || null,
    sortFn: sortFn_alphanumeric,
    size: 150,
  }),
  defineField({
    key: 'dances',
    label: 'Dances',
    render: renderDanceChips,
    cardRender: cardRenderDanceList,
    sortValue: (value) => value.length, // sort by dance count
    sortFn: sortFn_basic,
    size: 350,
    maxSize: 2000,
  }),
  defineField({
    key: 'notes',
    label: 'Notes',
    render: (value) => value ? <span title={value}>{value}</span> : mutedPlaceholder,
    sortValue: (value) => value || null, // sorts to the end if missing or empty
    sortFn: sortFn_alphanumeric,
    size: 250,
    maxSize: 500,
  }),
  defineField({
    key: 'created_at',
    label: 'Created',
    render: (value) => (value === null ? mutedPlaceholder : formatDate(value)),
    sortFn: sortFn_basic, // sorts by raw ISO timestamp
    size: 90,
  }),
  defineField({
    key: 'updated_at',
    label: 'Updated',
    render: (value) => (value === null ? mutedPlaceholder : formatDate(value)),
    sortFn: sortFn_basic, // sorts by raw ISO timestamp
    size: 90,
  }),
]

export const DEFAULT_COLUMN_STATE: TableColumnState = {
  columnVisibility: { created_at: false, updated_at: false },
  sorting: [{ id: 'date', desc: true }],
  columnPinning: { start: ['date'], end: [] },
  columnOrder: [], // defaults to the order columns were defined in
  columnSizing: {},
}

export type TableInstance = GenericTableInstance<ProgramWithJoins>
export type LeafHeader = GenericLeafHeader<ProgramWithJoins>

export const columns = buildColumns(programFields)
