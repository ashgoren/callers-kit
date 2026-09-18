export interface ComboboxOption {
  id: string
  label: string
}

export const CREATE_OPTION_ID = '__create__'

// Builds the item list a creatable combobox's dropdown shows for a given
// typed query, given the full set of real options (expected pre-sorted,
// e.g. alphabetically) and the currently committed selection, if any.
//
// - With no query typed yet, the current selection (if any) is pinned first.
// - With a query, options are filtered to substring matches on label.
//   If nothing matches exactly, a synthetic "create" entry is appended.
export function buildCreatableComboboxItems(
  options: ComboboxOption[],
  query: string,
  selectedId: string | null,
): ComboboxOption[] {
  const trimmedQuery = query.trim()

  if (trimmedQuery === '') {
    const selected = selectedId === null ? undefined : options.find((option) => option.id === selectedId)
    if (!selected) return options
    return [selected, ...options.filter((option) => option.id !== selectedId)]
  }

  const lowerQuery = trimmedQuery.toLowerCase()
  const filtered = options.filter((option) => option.label.toLowerCase().includes(lowerQuery))
  const hasExactMatch = options.some((option) => option.label.toLowerCase() === lowerQuery)

  return hasExactMatch ? filtered : [...filtered, { id: CREATE_OPTION_ID, label: trimmedQuery }]
}
