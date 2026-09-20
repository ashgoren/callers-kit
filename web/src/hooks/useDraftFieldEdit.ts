import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { z } from 'zod'
import type { FieldEditState } from '@/components/fields/InlineEditableField'

// For fields whose value is typed or otherwise adjusted freely, then
// committed at one deferred point (blur or Enter) rather than as each
// change happens - in this app, that's Dance's title and difficulty today,
// and eventually rich text (notes, figures content) once that's built.
//
// Not "the" hook for editing any field - a select, say, has no separate
// draft to hold at all (picking an option is itself an immediate commit)
// and needs its own hook returning the same FieldEditState shape instead of
// forcing that behavior through this one.
//
// The actual write is the caller's job (typically `commitFieldEdit`),
// passed in as `onCommit` so this hook has no idea it's talking to
// PowerSync at all.
export function useDraftFieldEdit<T>({ value, onCommit, schema }: {
  value: T
  onCommit: (value: T) => void
  schema?: z.ZodType<T>
}): FieldEditState<T> {
  const [isFocused, setIsFocused] = useState(false)
  const [editingDraft, setEditingDraft] = useState<T>(value)
  const [error, setError] = useState<string | null>(null)
  // The draft that produced the current error, if any. Lets a second
  // commit attempt (blur or Enter) with that exact same still-invalid draft
  // be told apart from a fresh one - see the schema-failure branch of
  // commit() below.
  const [lastRejectedDraft, setLastRejectedDraft] = useState<T | null>(null)
  // Set right when a commit succeeds; cleared once the live `value` prop
  // actually catches up to it. Bridges the real gap between committing (an
  // async write) and the reactive query that feeds `value` noticing it -
  // without this, unfocusing right after commit would show the still-stale
  // `value` prop for a moment, flashing the pre-edit content before the
  // query catches up and corrects it.
  const [optimisticValue, setOptimisticValue] = useState<T | undefined>(undefined)

  // Adjusting state during render (React's supported pattern for this,
  // not an effect): once the external value matches what was optimistically
  // expected, there's no more gap left to paper over. Safe from an infinite
  // loop - clearing it makes this condition false on the very next render.
  if (optimisticValue !== undefined && value === optimisticValue) {
    setOptimisticValue(undefined)
  }

  // While unfocused, prefer a just-committed optimistic value over the
  // live `value` prop if the two disagree (see above); otherwise this is
  // the same "value prop is the draft" behavior as before - an external
  // update (another device, a sync pull) still always gets through once
  // there's no pending optimistic value to prefer.
  const liveValue = optimisticValue !== undefined ? optimisticValue : value
  const draft = isFocused ? editingDraft : liveValue

  function onFocus() {
    setEditingDraft(liveValue)
    setIsFocused(true)
  }

  function onChange(next: T) {
    setEditingDraft(next)
  }

  function revert() {
    setEditingDraft(liveValue)
    setError(null)
    setLastRejectedDraft(null)
    setIsFocused(false)
  }

  function commit() {
    if (editingDraft === liveValue) {
      setIsFocused(false)
      return
    }
    if (schema) {
      const result = schema.safeParse(editingDraft)
      if (!result.success) {
        // A second attempt to leave with this exact same invalid draft -
        // rather than re-showing the same error and trapping focus back in
        // the field again on a device without an escape key, treat leaving
        // twice without changing anything as intent to give up on the edit.
        if (error !== null && editingDraft === lastRejectedDraft) {
          revert()
          return
        }
        setError(result.error.issues[0]?.message ?? 'Invalid value')
        setLastRejectedDraft(editingDraft)
        return
      }
    }
    setError(null)
    setLastRejectedDraft(null)
    setIsFocused(false)
    setOptimisticValue(editingDraft)
    onCommit(editingDraft)
  }

  function onBlur() {
    commit()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      revert()
    }
  }

  return { draft, error, isFocused, onFocus, onChange, onBlur, onKeyDown }
}
