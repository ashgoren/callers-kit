// A column that's SQL NULL when no value exists at all (e.g. calling_figures,
// which is null rather than '[]' when a dance has no separate calling
// script) - distinct from an empty array, which means the value exists but
// is empty. Every other JSON-encoded list column in this app is never null
// (it's '[]' at minimum), so a plain `JSON.parse(raw) as T[]` is clear
// enough on its own and doesn't need this wrapper.
export function parseNullableJsonArray<T>(raw: string | null): T[] | null {
  return raw === null ? null : (JSON.parse(raw) as T[])
}
