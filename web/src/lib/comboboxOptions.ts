export interface ComboboxOption {
  id: string
  label: string
}

export const CREATE_OPTION_ID = '__create__'

// Builds the item list a creatable combobox's dropdown shows for a given
// typed query, given the full set of real options (expected pre-sorted,
// e.g. alphabetically) and the currently selected id(s) - zero, one
// (single-select), or several (multi-select tag fields).
//
// - With no query typed yet, every currently selected option is pinned
//   first, in the given order, followed by the rest.
// - With a query, options are filtered to substring matches on label.
//   If nothing matches exactly, a synthetic "create" entry is appended.
export function buildCreatableComboboxItems(
  options: ComboboxOption[],
  query: string,
  selectedIds: string[],
): ComboboxOption[] {
  const trimmedQuery = query.trim()

  if (trimmedQuery === '') {
    const selected = options.filter((option) => selectedIds.includes(option.id))
    if (selected.length === 0) return options
    return [...selected, ...options.filter((option) => !selectedIds.includes(option.id))]
  }

  const lowerQuery = trimmedQuery.toLowerCase()
  const filtered = options.filter((option) => option.label.toLowerCase().includes(lowerQuery))
  const hasExactMatch = options.some((option) => option.label.toLowerCase() === lowerQuery)

  return hasExactMatch ? filtered : [...filtered, { id: CREATE_OPTION_ID, label: trimmedQuery }]
}
