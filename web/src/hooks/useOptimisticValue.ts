import { useState } from 'react'

// A local bridge over the async gap between a PowerSync write committing and
// its reactive query actually noticing the change and re-rendering with the
// new value - shows whatever was just set immediately, until the real value
// prop catches up with it, then gets out of the way again on its own.
//
// undefined (not a bare T | null) is the "nothing pending" sentinel - a real
// value can legitimately be null (e.g. an EditableRichText field whose true
// state is "empty"), so a bare T | null would be ambiguous about whether
// null means "no override" or "the override is null".
//
// isEqual defaults to a JSON.stringify comparison to handle arrays/objects.
// The parameter stays as an escape hatch for a caller with different needs.
export function useOptimisticValue<T>(
  value: T,
  isEqual: (a: T, b: T) => boolean = (a, b) => JSON.stringify(a) === JSON.stringify(b),
): [T, (next: T) => void] {
  const [optimisticValue, setOptimisticValue] = useState<T | undefined>(undefined)

  if (optimisticValue !== undefined && isEqual(value, optimisticValue)) {
    setOptimisticValue(undefined)
  }

  const displayValue = optimisticValue !== undefined ? optimisticValue : value

  return [displayValue, setOptimisticValue]
}
