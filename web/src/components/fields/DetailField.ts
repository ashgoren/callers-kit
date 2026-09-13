import type { ReactNode } from 'react'

// One descriptor per field shown on a detail page - deliberately not the
// table's Field<TRow> (components/table/fieldColumns.ts), which carries
// column-only concerns (sortFn/size/cardRender) that have no meaning here.
export interface DetailField<TRow, K extends keyof TRow = keyof TRow> {
  key: K
  label: string
  render: (value: TRow[K]) => ReactNode
}

// Mirrors makeFieldDefiner's role: lets TypeScript infer K from a single
// field's key, since TRow and K can't both be inferred from one call.
export function makeDetailFieldDefiner<TRow>() {
  return function defineDetailField<K extends keyof TRow>(field: DetailField<TRow, K>): DetailField<TRow> {
    return field as unknown as DetailField<TRow>
  }
}
