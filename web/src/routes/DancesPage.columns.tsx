import {
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
import type { Dance } from '@/lib/powersync/schema'

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
  // Defaults to hideable (undefined reads as true, matching TanStack's per-column default)
  enableHiding?: boolean
  // What to actually compare when sorting by this column - defaults to the
  // raw value itself (via the fallback below). Only needed when the
  // sortable value differs from what TanStack would read directly off the
  // row: formation strips its "Duple Minor - " prefix for display and
  // should sort the same way, and a tag list sorts by its first
  // alphabetical entry, matching how it displays. Returning null sorts the
  // row to the very end regardless of ascending vs. descending - the same
  // place a missing value belongs either way (see sortUndefined below).
  sortValue?: (value: DanceWithJoins[K]) => string | number | null
  // This field is a passthrough: it receives a concrete built-in like
  // sortFn_alphanumeric (typed SortFn<any, any>) and later hands it back out
  // to TanStack's own, differently-parameterized `sortFn` column option -
  // two opposite variance directions no single non-`any` param type can
  // satisfy at once, so `any` here is the actual correct tool.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sortFn?: (rowA: any, rowB: any, columnId: string) => number
  // Falls back to the defaultColumn sizes set on useTable() in DancesPage.tsx
  // - only set here for fields that clearly want to start wider or narrower.
  size?: number
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
    enableHiding: false,
    // Empty string reads the same as "missing" here - both sort to the end.
    sortValue: (value) => value || null,
    sortFn: sortFn_alphanumeric,
    size: 250,
    minSize: 120,
  }),
  defineField({
    key: 'difficulty',
    label: 'Difficulty',
    render: (value) => (value === null ? mutedPlaceholder : value),
    sortFn: sortFn_basic,
    size: 85,
    minSize: 85,
  }),
  defineField({
    key: 'formation',
    label: 'Formation',
    render: (value) => (value === null ? mutedPlaceholder : formatFormation(value)),
    // Sorts by the same stripped-prefix string it displays, not raw enum value.
    sortValue: (value) => (value === null ? null : formatFormation(value)),
    sortFn: sortFn_alphanumeric,
    size: 95,
    minSize: 95,
  }),
  defineField({
    key: 'choreographers',
    label: 'Choreographers',
    render: renderTagList,
    sortValue: (value) => sortAlphabetically(value)[0] ?? null, // first choreographer alphabetically
    sortFn: sortFn_alphanumeric,
    size: 170,
    minSize: 120,
  }),
  defineField({
    key: 'key_moves',
    label: 'Key Moves',
    render: renderTagList,
    sortValue: (value) => sortAlphabetically(value)[0] ?? null, // first key_move alphabetically
    sortFn: sortFn_alphanumeric,
    minSize: 95,
  }),
  defineField({
    key: 'vibes',
    label: 'Vibes',
    render: renderTagList,
    sortValue: (value) => sortAlphabetically(value)[0] ?? null, // first vibe alphabetically
    sortFn: sortFn_alphanumeric,
    size: 90,
    minSize: 60,
  }),
  defineField({
    key: 'notes',
    label: 'Notes',
    render: (value) => value ? <span title={value}>{value}</span> : mutedPlaceholder,
    cardRender: (value) => value ? <span className="block truncate" title={value}>{value}</span> : mutedPlaceholder,
    sortValue: (value) => value || null, // sorts to the end if missing or empty
    sortFn: sortFn_alphanumeric,
    size: 260,
    minSize: 70,
    maxSize: 500,
  }),
  defineField({
    key: 'created_at',
    label: 'Created',
    render: (value) => (value === null ? mutedPlaceholder : formatDate(value)),
    sortFn: sortFn_basic, // sorts by raw ISO timestamp
    size: 80,
    minSize: 80,
  }),
  defineField({
    key: 'updated_at',
    label: 'Updated',
    render: (value) => (value === null ? mutedPlaceholder : formatDate(value)),
    sortFn: sortFn_basic, // sorts by raw ISO timestamp
    size: 80,
    minSize: 80,
  }),
]

// Only the features this table actually uses are registered - TanStack Table
// v9 only installs a feature's state/APIs once it's registered here, so this
// list is deliberately not stockFeatures (which would register everything).
export const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnSizingFeature,
  columnResizingFeature,
})

const columnHelper = createColumnHelper<typeof features, DanceWithJoins>()

export const columns = columnHelper.columns(
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
        size: field.size,
        minSize: field.minSize,
        maxSize: field.maxSize,
        sortFn: field.sortFn,
        // Missing values (now undefined, see above) always sort last,
        // regardless of ascending vs. descending - blank cells staying put
        // at the bottom rather than jumping to the top when you flip
        // direction, matching how spreadsheets handle this.
        sortUndefined: 'last',
      },
    ),
  ),
)
