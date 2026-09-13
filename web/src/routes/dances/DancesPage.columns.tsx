import { sortFn_alphanumeric, sortFn_basic } from '@tanstack/react-table'
import { buildColumns, makeFieldDefiner } from '@/components/table/fieldColumns'
import { TruncatedTooltipText } from '@/components/table/TruncatedTooltipText'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDate, mutedPlaceholder, sortAlphabetically } from '@/lib/format'
import { formatProgramLabel } from '@/routes/programs/ProgramsPage.columns'
import type { ReactNode } from 'react'
import type { Field } from '@/components/table/fieldColumns'
import type { LeafHeader as GenericLeafHeader, TableInstance as GenericTableInstance } from '@/components/table/tableInstance'
import type { Dance } from '@/lib/powersync/schema'
import type { TableColumnState } from '@/lib/powersync/tablePreferences'
import type { ProgramSummary } from '@/routes/programs/ProgramsPage.columns'

export interface DanceWithJoins extends Dance {
  choreographers: string[]
  key_moves: string[]
  vibes: string[]
  programs: ProgramSummary[]
}

export function formatFormation(value: string | null): string {
  return value ? value.replace(/^Duple Minor - /, '') : '—'
}

function renderTagList(value: string[]): ReactNode {
  return value.length > 0 ? sortAlphabetically(value).join(', ') : mutedPlaceholder
}

// Table view: compact dates only with full "date @ location" labels via hover.
function renderProgramList(value: ProgramSummary[]): ReactNode {
  if (value.length === 0) return mutedPlaceholder
  const tooltip = value.map(formatProgramLabel).join('\n')
  return (
    <Tooltip>
      <TooltipTrigger>{value.map((program) => formatDate(program.date)).join(', ')}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

// Card view: full "date @ location" labels, one per line.
function cardRenderProgramList(value: ProgramSummary[]): ReactNode {
  if (value.length === 0) return mutedPlaceholder
  return (
    <ul className="space-y-0.5">
      {value.map((program) => (
        <li key={program.id}>{formatProgramLabel(program)}</li>
      ))}
    </ul>
  )
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
    key: 'dance_type',
    label: 'Dance Type',
    render: (value) => (value === null ? mutedPlaceholder : value),
    sortValue: (value) => value || null,
    sortFn: sortFn_alphanumeric,
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
    key: 'progression',
    label: 'Progression',
    render: (value) => (value === null ? mutedPlaceholder : value),
    sortValue: (value) => value || null,
    sortFn: sortFn_alphanumeric,
    size: 105,
  }),
  defineField({
    key: 'notes',
    label: 'Notes',
    render: (value) => (value ? <TruncatedTooltipText content={value}>{value}</TruncatedTooltipText> : mutedPlaceholder),
    // Plain text, not the table's hover-tooltip trigger - the card list is
    // the touch layout, where there's no hover to reveal it.
    cardRender: (value) => value ? <span>{value}</span> : mutedPlaceholder,
    sortValue: (value) => value || null, // sorts to the end if missing or empty
    sortFn: sortFn_alphanumeric,
    size: 250,
    maxSize: 500,
  }),
  defineField({
    key: 'programs',
    label: 'Programs',
    render: renderProgramList,
    cardRender: cardRenderProgramList,
    // Sorts by the dance's most recently called program - the array is
    // already date-descending from the query, so the first entry is it.
    sortValue: (value) => value[0]?.date ?? null,
    sortFn: sortFn_basic,
    sortDescFirst: true,
    size: 150,
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
  columnVisibility: { dance_type: false },
  sorting: [{ id: 'title', desc: false }],
  columnPinning: { start: ['title'], end: [] },
  columnOrder: [], // defaults to the order columns were defined in
  columnSizing: {},
}

export type TableInstance = GenericTableInstance<DanceWithJoins>
export type LeafHeader = GenericLeafHeader<DanceWithJoins>

export const columns = buildColumns(danceFields)
