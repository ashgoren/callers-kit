import { format } from 'date-fns'

// The shared "missing value" convention for a table cell, card field, or any
// other display of a value that may be null/empty.
export const mutedPlaceholder = <span className="text-muted-foreground">—</span>

export function formatDate(value: string | null): string {
  return value ? format(new Date(value), 'M/d/yy') : '—'
}

// Locale-aware, so accented names still land where a reader would expect.
export function sortAlphabetically(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b))
}
