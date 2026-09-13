import {
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import type { ReactNode } from 'react'
import type { SortFn, useTable } from '@tanstack/react-table'
import type { Dance } from '@/lib/powersync/schema'
import type { TableColumnState } from '@/lib/powersync/tablePreferences'

export interface DanceWithJoins extends Dance {
  choreographers: string[]
  key_moves: string[]
  vibes: string[]
}

const mutedPlaceholder = <span className="text-muted-foreground">—</span>

export function formatDate(value: string | null): string {
  return value ? format(new Date(value), 'M/d/yy') : '—'
}

export function formatFormation(value: string | null): string {
  return value ? value.replace(/^Duple Minor - /, '') : '—'
}

// Locale-aware, so accented names still land where a reader would expect.
function sortAlphabetically(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b))
}

function renderTagList(value: string[]): ReactNode {
  return value.length > 0 ? sortAlphabetically(value).join(', ') : mutedPlaceholder
}

// One source of truth for both the table columns and DanceCard's fields.
// Each field's `render` drives both by default, but, when present,
// `cardRender` overrides just the card's display for that field.
interface DanceField<K extends keyof DanceWithJoins = keyof DanceWithJoins> {
  key: K
  label: string
  render: (value: DanceWithJoins[K]) => ReactNode
  cardRender?: (value: DanceWithJoins[K]) => ReactNode
  enableHiding?: boolean
  sortValue?: (value: DanceWithJoins[K]) => string | number | null
  sortFn?: SortFn<typeof features, DanceWithJoins>
  size?: number
  compactSize?: number
  minSize?: number
  maxSize?: number
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
    sortValue: (value) => value || null,
    sortFn: sortFn_alphanumeric,
    size: 250,
    minSize: 80,
  }),
  defineField({
    key: 'choreographers',
    label: 'Choreographers',
    render: renderTagList,
    sortValue: (value) => sortAlphabetically(value)[0] ?? null, // first choreographer alphabetically
    sortFn: sortFn_alphanumeric,
    size: 150,
    minSize: 80,
  }),
  defineField({
    key: 'key_moves',
    label: 'Key Moves',
    render: renderTagList,
    sortValue: (value) => sortAlphabetically(value)[0] ?? null, // first key_move alphabetically
    sortFn: sortFn_alphanumeric,
    size: 105,
    minSize: 80,
  }),
  defineField({
    key: 'vibes',
    label: 'Vibes',
    render: renderTagList,
    sortValue: (value) => sortAlphabetically(value)[0] ?? null, // first vibe alphabetically
    sortFn: sortFn_alphanumeric,
    size: 105,
    minSize: 80,
  }),
  defineField({
    key: 'difficulty',
    label: 'Difficulty',
    render: (value) => (value === null ? mutedPlaceholder : value),
    sortFn: sortFn_basic,
    size: 105,
    minSize: 80,
  }),
  defineField({
    key: 'formation',
    label: 'Formation',
    render: (value) => (value === null ? mutedPlaceholder : formatFormation(value)),
    // Sorts by the same stripped-prefix string it displays, not raw enum value.
    sortValue: (value) => (value === null ? null : formatFormation(value)),
    sortFn: sortFn_alphanumeric,
    size: 105,
    minSize: 80,
  }),
  defineField({
    key: 'notes',
    label: 'Notes',
    render: (value) => value ? <span title={value}>{value}</span> : mutedPlaceholder,
    cardRender: (value) => value ? <span className="block truncate" title={value}>{value}</span> : mutedPlaceholder,
    sortValue: (value) => value || null, // sorts to the end if missing or empty
    sortFn: sortFn_alphanumeric,
    size: 250,
    minSize: 80,
    maxSize: 500,
  }),
  defineField({
    key: 'created_at',
    label: 'Created',
    render: (value) => (value === null ? mutedPlaceholder : formatDate(value)),
    sortFn: sortFn_basic, // sorts by raw ISO timestamp
    size: 90,
    minSize: 80,
  }),
  defineField({
    key: 'updated_at',
    label: 'Updated',
    render: (value) => (value === null ? mutedPlaceholder : formatDate(value)),
    sortFn: sortFn_basic, // sorts by raw ISO timestamp
    size: 90,
    minSize: 80,
  }),
]

// Shared by every place that needs a field's label/render given a column id
// (the manage-columns menu, the mobile sort menu, the card list) rather than
// each re-implementing the same find().
export function getDanceField(key: string) {
  return danceFields.find((field) => field.key === key)
}

export const DEFAULT_COLUMN_STATE: TableColumnState = {
  columnVisibility: {},
  sorting: [{ id: 'title', desc: false }],
  columnPinning: { start: ['title'], end: [] },
  columnOrder: [], // defaults to the order columns were defined in
  columnSizing: {},
}

// Tanstack Table features this table actually uses are registered.
export const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnSizingFeature,
  columnResizingFeature,
  columnPinningFeature,
  columnOrderingFeature,
})

export type TableInstance = ReturnType<typeof useTable<typeof features, DanceWithJoins>>
export type LeafHeader = ReturnType<TableInstance['getLeafHeaders']>[number]

const columnHelper = createColumnHelper<typeof features, DanceWithJoins>()

// Builds this table's column definitions for the given breakpoint -
// isDesktopWidth picks each field's `size` vs. `compactSize` as the starting
// width. Only affects a column nobody's resized yet on this device; once
// resized, the saved width overrides this regardless of breakpoint.
export function makeColumns({ isDesktopWidth }: { isDesktopWidth: boolean }) {
  return columnHelper.columns(
    danceFields.map((field) =>
      columnHelper.accessor(
        // A function accessor, not a plain key, so this can resolve to
        // field.sortValue's result (falling back to the raw value) instead of
        // always reading the row directly - the sort machinery needs this
        // resolved value, but rendering below deliberately doesn't use it.
        (row) => {
          const raw = row[field.key]
          const resolved = field.sortValue ? field.sortValue(raw) : raw
          // Coalesces null (this app's "missing" sentinel) to undefined,
          // which is what sortUndefined below actually checks for.
          return resolved ?? undefined
        },
        {
          id: field.key,
          header: field.label,
          // Reads the untouched original row, not this accessor's resolved
          // value above - that value exists purely to feed the sort
          // machinery, and shouldn't also change what's rendered.
          cell: (info) => field.render(info.row.original[field.key]),
          enableHiding: field.enableHiding,
          size: isDesktopWidth ? field.size : (field.compactSize ?? field.size),
          minSize: field.minSize,
          maxSize: field.maxSize,
          sortFn: field.sortFn,
          sortUndefined: 'last',
        },
      ),
    ),
  )
}
