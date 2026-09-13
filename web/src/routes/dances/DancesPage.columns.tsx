import { sortFn_alphanumeric, sortFn_basic } from '@tanstack/react-table'
import { buildColumns, makeFieldDefiner } from '@/components/table/fieldColumns'
import { formatDate, mutedPlaceholder, sortAlphabetically } from '@/lib/format'
import type { ReactNode } from 'react'
import type { Field } from '@/components/table/fieldColumns'
import type { LeafHeader as GenericLeafHeader, TableInstance as GenericTableInstance } from '@/components/table/tableInstance'
import type { Dance } from '@/lib/powersync/schema'
import type { TableColumnState } from '@/lib/powersync/tablePreferences'

export interface DanceWithJoins extends Dance {
  choreographers: string[]
  key_moves: string[]
  vibes: string[]
}

export function formatFormation(value: string | null): string {
  return value ? value.replace(/^Duple Minor - /, '') : '—'
}

function renderTagList(value: string[]): ReactNode {
  return value.length > 0 ? sortAlphabetically(value).join(', ') : mutedPlaceholder
}

const defineField = makeFieldDefiner<DanceWithJoins>()

export const danceFields: Field<DanceWithJoins>[] = [
  defineField({
    key: 'title',
    label: 'Title',
    render: (value) => value || mutedPlaceholder,
    sortValue: (value) => value || null,
    sortFn: sortFn_alphanumeric,
    size: 250,
  }),
  defineField({
    key: 'choreographers',
    label: 'Choreographers',
    render: renderTagList,
    sortValue: (value) => sortAlphabetically(value)[0] ?? null, // first choreographer alphabetically
    sortFn: sortFn_alphanumeric,
    size: 150,
  }),
  defineField({
    key: 'key_moves',
    label: 'Key Moves',
    render: renderTagList,
    sortValue: (value) => sortAlphabetically(value)[0] ?? null, // first key_move alphabetically
    sortFn: sortFn_alphanumeric,
    size: 105,
  }),
  defineField({
    key: 'vibes',
    label: 'Vibes',
    render: renderTagList,
    sortValue: (value) => sortAlphabetically(value)[0] ?? null, // first vibe alphabetically
    sortFn: sortFn_alphanumeric,
    size: 105,
  }),
  defineField({
    key: 'difficulty',
    label: 'Difficulty',
    render: (value) => (value === null ? mutedPlaceholder : value),
    sortFn: sortFn_basic,
    size: 105,
  }),
  defineField({
    key: 'formation',
    label: 'Formation',
    render: (value) => (value === null ? mutedPlaceholder : formatFormation(value)),
    // Sorts by the same stripped-prefix string it displays, not raw enum value.
    sortValue: (value) => (value === null ? null : formatFormation(value)),
    sortFn: sortFn_alphanumeric,
    size: 105,
  }),
  defineField({
    key: 'notes',
    label: 'Notes',
    render: (value) => value ? <span title={value}>{value}</span> : mutedPlaceholder,
    cardRender: (value) => value ? <span className="block truncate" title={value}>{value}</span> : mutedPlaceholder,
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
  columnVisibility: {},
  sorting: [{ id: 'title', desc: false }],
  columnPinning: { start: ['title'], end: [] },
  columnOrder: [], // defaults to the order columns were defined in
  columnSizing: {},
}

export type TableInstance = GenericTableInstance<DanceWithJoins>
export type LeafHeader = GenericLeafHeader<DanceWithJoins>

export const columns = buildColumns(danceFields)
