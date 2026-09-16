import { useState } from 'react'
import type { FieldEditState } from '@/components/fields/InlineEditableField'

// For long, effortful Tiptap fields with room for explicit controls - in
// this app, Dance/Program notes and walkthrough. Losing a paragraph of
// carefully-written notes to one stray blur or Escape press is a real
// cost, unlike a short figure line or cue cell (which will use a simpler,
// immediate-commit hook once figures/cues are built) - so this hook never
// commits or discards implicitly at all. `onChange` (wired to an explicit
// Save action) is the only way this ever commits; blurring away does
// nothing.
//
// Leaving without saving - the Cancel button, or Escape, which are the
// same action - goes through `attemptCancel` rather than `onKeyDown`,
// because it needs the current (uncommitted) editor content to know
// whether there's anything to confirm, and only the caller (which owns
// the actual Tiptap editor instance) has that - this hook has no
// visibility into the editor itself. If nothing has changed, it closes
// immediately; otherwise it arms a "confirm discard" prompt (rendered via
// the normal `error` slot) rather than throwing the edit away on the
// first attempt, requiring one more explicit confirmation first.
export function useSaveCancelFieldEdit<T>({ value, onCommit }: {
  value: T
  onCommit: (value: T) => void
}): FieldEditState<T> & { attemptCancel: (current: T) => void } {
  const [isFocused, setIsFocused] = useState(false)
  // `undefined`, not a bare `T | null`, as the "nothing pending" sentinel -
  // see the identical concern (and the same fix) in useDraftFieldEdit.
  const [optimisticValue, setOptimisticValue] = useState<T | undefined>(undefined)
  const [discardWarning, setDiscardWarning] = useState<string | null>(null)

  if (optimisticValue !== undefined && value === optimisticValue) {
    setOptimisticValue(undefined)
  }

  const liveValue = optimisticValue !== undefined ? optimisticValue : value

  function onFocus() {
    setIsFocused(true)
  }

  // Save - the only way this field ever commits.
  function onChange(next: T) {
    setIsFocused(false)
    setDiscardWarning(null)
    if (next === liveValue) return
    setOptimisticValue(next)
    onCommit(next)
  }

  // Deliberately does nothing.
  function onBlur() {}

  function attemptCancel(current: T) {
    if (current === liveValue) {
      setIsFocused(false)
      return
    }
    if (discardWarning === null) {
      setDiscardWarning('Discard your changes?')
      return
    }
    setDiscardWarning(null)
    setIsFocused(false)
  }

  // Escape itself is handled by the caller (it calls attemptCancel
  // directly, with the current content) - this only clears an already-
  // armed discard warning on any other key, so continuing to type after
  // seeing the prompt lets editing continue rather than forcing a choice.
  function onKeyDown() {
    if (discardWarning !== null) setDiscardWarning(null)
  }

  return { draft: liveValue, error: discardWarning, isFocused, onFocus, onChange, onBlur, onKeyDown, attemptCancel }
}
