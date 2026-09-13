import { format, parseISO } from 'date-fns'

// The shared "missing value" convention for a table cell or card field.
export const mutedPlaceholder = <span className="text-muted-foreground">—</span>

// parseISO, not `new Date(value)`:
// a date-only string is parsed by `new Date()` as UTC midnight, so
// formatting it in a timezone behind UTC would display the previous day.
// parseISO reads a date-only string as local time instead, while still
// honoring the offset/Z on a full timestamp the same way `new Date()` does.
export function formatDate(value: string | null): string {
  return value ? format(parseISO(value), 'M/d/yy') : '—'
}

// Locale-aware, so accented names still land where a reader would expect.
export function sortAlphabetically(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b))
}
