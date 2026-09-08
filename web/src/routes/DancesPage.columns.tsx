import { createColumnHelper, tableFeatures } from '@tanstack/react-table'
import { format } from 'date-fns'
import type { ReactNode } from 'react'
import type { Dance } from '@/lib/powersync/schema'

export interface DanceWithJoins extends Dance {
  choreographers: string[]
}

const mutedPlaceholder = <span className="text-muted-foreground">—</span>

export function formatDate(value: string | null): string {
  return value ? format(new Date(value), 'M/d/yy') : '—'
}

export function formatFormation(value: string | null): string {
  return value ? value.replace(/^Duple Minor - /, '') : '—'
}

function renderTagList(value: string[]): ReactNode {
  return value.length > 0 ? value.join(', ') : mutedPlaceholder
}

// One source of truth for both the table columns and DanceCard's fields.
// Each field's `render` drives both by default, but, when present,
// `cardRender` overrides just the card's display for that field.
interface DanceField<K extends keyof DanceWithJoins = keyof DanceWithJoins> {
  key: K
  label: string
  render: (value: DanceWithJoins[K]) => ReactNode
  cardRender?: (value: DanceWithJoins[K]) => ReactNode
}

// This exists purely to help TypeScript infer the generic type parameter K from the field's key.
function defineField<K extends keyof DanceWithJoins>(field: DanceField<K>): DanceField {
  return field as unknown as DanceField
}

export const danceFields: DanceField[] = [
  defineField({
    key: 'title',
    label: 'Title',
    render: (value) => value || mutedPlaceholder,
  }),
  defineField({
    key: 'difficulty',
    label: 'Difficulty',
    render: (value) => (value === null ? mutedPlaceholder : value),
  }),
  defineField({
    key: 'formation',
    label: 'Formation',
    render: (value) => (value === null ? mutedPlaceholder : formatFormation(value)),
  }),
  defineField({
    key: 'choreographers',
    label: 'Choreographers',
    render: renderTagList,
  }),
  defineField({
    key: 'notes',
    label: 'Notes',
    render: (value) => value ? <span className="block max-w-xs truncate" title={value}>{value}</span> : mutedPlaceholder,
    cardRender: (value) => value ? <span className="block truncate" title={value}>{value}</span> : mutedPlaceholder,
  }),
  defineField({
    key: 'created_at',
    label: 'Created',
    render: (value) => (value === null ? mutedPlaceholder : formatDate(value)),
  }),
  defineField({
    key: 'updated_at',
    label: 'Updated',
    render: (value) => (value === null ? mutedPlaceholder : formatDate(value)),
  }),
]

// Empty for now - no sort/filter/paginate/reorder/etc. yet (that's a later
// phase), and TanStack Table v9 only installs a feature's state/APIs once
// it's actually registered here, so an empty registration is the correct
// minimal table for a plain read-only render, not a placeholder to fill in.
export const features = tableFeatures({})

const columnHelper = createColumnHelper<typeof features, DanceWithJoins>()

export const columns = columnHelper.columns(
  danceFields.map((field) =>
    columnHelper.accessor(field.key, {
      header: field.label,
      cell: (info) => field.render(info.getValue()),
    }),
  ),
)
