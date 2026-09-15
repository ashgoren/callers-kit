import { useState } from 'react'
import type { FieldEditState } from '@/components/fields/InlineEditableField'

// For fields where picking an option is itself the commit, with nothing to
// hold as a separate in-progress draft - in this app, that's Dance's
// dance_type/formation/progression, each a fixed, closed vocabulary where
// every choice is already valid, so there's nothing to validate either.
//
// "Blur" here means the picker closed for any reason - an option was
// picked, Escape was pressed, or the user clicked away - since Select
// itself is what decides when that happens, not a keystroke this hook
// reacts to. onKeyDown is a no-op included only to satisfy FieldEditState.
export function useSelectFieldEdit<T>({ value, onCommit }: {
  value: T
  onCommit: (value: T) => void
}): FieldEditState<T> {
  const [isFocused, setIsFocused] = useState(false)
  const [optimisticValue, setOptimisticValue] = useState<T | undefined>(undefined)

  if (optimisticValue !== undefined && value === optimisticValue) {
    setOptimisticValue(undefined)
  }

  const liveValue = optimisticValue !== undefined ? optimisticValue : value

  function onFocus() {
    setIsFocused(true)
  }

  function onChange(next: T) {
    setOptimisticValue(next)
    onCommit(next)
  }

  function onBlur() {
    setIsFocused(false)
  }

  function onKeyDown() {
    // Select handles its own keyboard interaction (arrow keys, Enter,
    // Escape) internally - closing always routes back through onBlur via
    // its own onOpenChange, regardless of what closed it.
  }

  return { draft: liveValue, error: null, isFocused, onFocus, onChange, onBlur, onKeyDown }
}
