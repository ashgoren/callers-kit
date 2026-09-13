import { createColumnHelper } from '@tanstack/react-table'
import { dataTableFeatures } from './tableInstance'
import type { ReactNode } from 'react'
import type { RowData, SortFn } from '@tanstack/react-table'

// One source of truth for both an entity's table columns and its card-list
// fields (the phone-width fallback). Each field's `render` drives both by
// default, but, when present, `cardRender` overrides just the card's display
// for that field.
export interface Field<TRow extends RowData, K extends keyof TRow = keyof TRow> {
  key: K
  label: string
  render: (value: TRow[K]) => ReactNode
  cardRender?: (value: TRow[K]) => ReactNode
  enableHiding?: boolean
  sortValue?: (value: TRow[K]) => string | number | null
  sortFn?: SortFn<typeof dataTableFeatures, TRow>
  size?: number
  minSize?: number
  maxSize?: number
}

// Returns a defineField bound to one entity's row type, so each call site
// only has to supply the field's own key/value types (K), inferred from the
// object literal itself - TRow can't cleanly be inferred at the same time as
// K from a single call, so each entity's columns file fixes TRow once here
// rather than every field spelling it out.
export function makeFieldDefiner<TRow extends RowData>() {
  // This exists purely to help TypeScript infer K from the field's key.
  return function defineField<K extends keyof TRow>(field: Field<TRow, K>): Field<TRow> {
    return field as unknown as Field<TRow>
  }
}

// Builds a table's TanStack columns straight from its field list, so a
// column's id/header/cell/sort behavior always stays in sync with the same
// field descriptor the card list and column-label lookups use.
export function buildColumns<TRow extends RowData>(fields: Field<TRow>[]) {
  const columnHelper = createColumnHelper<typeof dataTableFeatures, TRow>()

  return columnHelper.columns(
    fields.map((field) =>
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
          id: field.key as string,
          header: field.label,
          // Reads the untouched original row, not this accessor's resolved
          // value above - that value exists purely to feed the sort
          // machinery, and shouldn't also change what's rendered.
          cell: (info) => field.render(info.row.original[field.key]),
          enableHiding: field.enableHiding,
          size: field.size,
          ...(field.minSize !== undefined && { minSize: field.minSize }),
          ...(field.maxSize !== undefined && { maxSize: field.maxSize }),
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
}
