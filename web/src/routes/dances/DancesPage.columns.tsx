import { sortFn_alphanumeric, sortFn_basic } from '@tanstack/react-table'
import { Link } from 'react-router'
import { buildColumns, makeFieldDefiner } from '@/components/table/fieldColumns'
import { TruncatedTooltipText } from '@/components/table/TruncatedTooltipText'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDate, mutedPlaceholder, sortAlphabetically } from '@/lib/format'
import { htmlToPlainText } from '@/lib/sanitizeHtml'
import { formatProgramLabel } from '@/routes/programs/ProgramsPage.columns'
import type { ReactNode } from 'react'
import type { Field } from '@/components/table/fieldColumns'
import type { LeafHeader as GenericLeafHeader, TableInstance as GenericTableInstance } from '@/components/table/tableInstance'
import type { Dance } from '@/lib/powersync/schema'
import type { TableColumnState } from '@/lib/powersync/tablePreferences'
import type { ProgramSummary } from '@/routes/programs/ProgramsPage.columns'
import type { TagOption } from './DancesPage.data'

// notes isn't a real column on Dance - danceSelectColumns() extracts
// the primary version's own notes and aliases it back to "notes".
export interface DanceWithJoins extends Dance {
  notes: string | null
  choreographers: TagOption[]
  key_moves: TagOption[]
  vibes: TagOption[]
  programs: ProgramSummary[]
}

export function formatFormation(value: string | null): string {
  return value ? value.replace(/^Duple Minor - /, '') : '—'
}

// The short, combined "what kind of dance is this" label - dance_type and
// progression are only worth mentioning when they're something other than
// the overwhelmingly common case (Contra, Single progression), so most
// dances show just their formation (e.g. "Improper", "Becket").
export function makeFiguresLabel(dance: {
  dance_type: string | null
  formation: string | null
  progression: string | null
}): string {
  return [
    dance.dance_type && dance.dance_type.toLowerCase() !== 'contra' ? dance.dance_type : null,
    dance.formation ? formatFormation(dance.formation) : null,
    dance.progression && dance.progression.toLowerCase() !== 'single' ? `${dance.progression} progression` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function renderTagList(value: TagOption[]): ReactNode {
  if (value.length === 0) return mutedPlaceholder
  return sortAlphabetically(value.map((tag) => tag.name ?? '')).join(', ')
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
        <li key={program.id}>
          <Link to={`/programs/${program.id}`} className="hover:underline">
            {formatProgramLabel(program)}
          </Link>
        </li>
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
    sortValue: (value) => sortAlphabetically(value.map((tag) => tag.name ?? ''))[0] ?? null, // first choreographer alphabetically
    sortFn: sortFn_alphanumeric,
    size: 150,
  }),
  defineField({
    key: 'key_moves',
    label: 'Key Moves',
    render: renderTagList,
    sortValue: (value) => sortAlphabetically(value.map((tag) => tag.name ?? ''))[0] ?? null, // first key_move alphabetically
    sortFn: sortFn_alphanumeric,
    size: 105,
  }),
  defineField({
    key: 'vibes',
    label: 'Vibes',
    render: renderTagList,
    sortValue: (value) => sortAlphabetically(value.map((tag) => tag.name ?? ''))[0] ?? null, // first vibe alphabetically
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
    render: (value) => {
      const preview = value ? htmlToPlainText(value) : ''
      return preview ? <TruncatedTooltipText content={preview}>{preview}</TruncatedTooltipText> : mutedPlaceholder
    },
    cardRender: (value) => {
      const preview = value ? htmlToPlainText(value) : ''
      return preview ? <span>{preview}</span> : mutedPlaceholder
    },
    sortValue: (value) => (value ? htmlToPlainText(value) : null), // sorts to the end if missing or empty
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
    label: 'Added',
    render: (value) => (value === null ? mutedPlaceholder : formatDate(value)),
    sortFn: sortFn_basic, // sorts by raw ISO timestamp
    sortDescFirst: true,
    size: 90,
  }),
  defineField({
    key: 'updated_at',
    label: 'Edited',
    render: (value) => (value === null ? mutedPlaceholder : formatDate(value)),
    sortFn: sortFn_basic, // sorts by raw ISO timestamp
    sortDescFirst: true,
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
