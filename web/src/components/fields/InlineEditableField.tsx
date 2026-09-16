import { cn } from 'cn'
import { useId, useLayoutEffect, useRef } from 'react'
import type { ElementType, KeyboardEvent, ReactNode, RefObject } from 'react'

// What this shell needs to drive the view/edit toggle - deliberately not
// specific to any one commit model. useDraftFieldEdit (a local draft,
// committed at blur/Enter) is one implementation; a field whose commit
// model looks nothing like that - a select, where picking an option is
// itself an immediate commit with no separate draft to hold - implements
// its own hook returning this same shape instead.
export interface FieldEditState<T> {
  draft: T
  error: string | null
  isFocused: boolean
  onFocus: () => void
  onChange: (value: T) => void
  onBlur: () => void
  onKeyDown: (e: KeyboardEvent) => void
}

// The shared "click (or tap) to edit" shell every Editable* field builds on:
// a read-mode display that swaps to a real input once activated, rather
// than disguising an always-present input as plain text. Read mode keeps
// whatever semantic element the caller needs (a real <h1> for a page title,
// say) - the swap to an actual input only happens once genuinely editing,
// so there's nothing fighting the input's own preset styling to make it
// look like something else.
//
// Takes a FieldEditState<T> directly (spread in by the caller) rather than
// building one itself - this shell only cares about isFocused/draft/error
// and the handlers, not which hook or commit model produced them.
export function InlineEditableField<T>({
  draft,
  error,
  isFocused,
  onFocus,
  onChange,
  onBlur,
  onKeyDown,
  as: As = 'span',
  className,
  fullWidth = false,
  renderDisplay,
  renderInput,
}: FieldEditState<T> & {
  as?: ElementType
  className?: string
  fullWidth?: boolean
  renderDisplay: (value: T) => ReactNode
  renderInput: (props: {
    draft: T
    onChange: (value: T) => void
    onBlur: () => void
    onKeyDown: (e: KeyboardEvent) => void
    hasError: boolean
    errorId: string
    ref: RefObject<HTMLElement | null>
  }) => ReactNode
}) {
  const errorId = useId()
  const inputRef = useRef<HTMLElement>(null)

  // A blur-triggered commit that fails validation stays in edit mode
  // (isFocused never flips back to false) so the error can show - but the
  // browser has already moved real focus away by the time that blur event
  // even reaches onBlur, useLayoutEffect pulls focus back before the
  // browser paints, so there's no visible flicker of it being unfocused.
  useLayoutEffect(() => {
    if (isFocused && error !== null) {
      inputRef.current?.focus()
    }
  }, [isFocused, error])

  if (!isFocused) {
    return (
      <As
        tabIndex={0}
        onClick={onFocus}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onFocus()
          }
        }}
        // inline-block shrinks the hover/click target to the content itself;
        // block instead spans the full width of the container (see the
        // fullWidth prop above). border-transparent (not border-0/no border)
        // + the same px-2.5 py-1 padding Input itself uses: border-*width*
        // and padding never change between this and the actual input it
        // swaps to, so the box is exactly the same height in both states.
        className={cn(
          fullWidth ? 'block' : 'inline-block',
          'cursor-pointer rounded-lg border border-transparent px-2.5 py-1 hover:bg-muted/50',
          className,
        )}
      >
        {renderDisplay(draft)}
      </As>
    )
  }

  return (
    <div>
      {renderInput({ draft, onChange, onBlur, onKeyDown, hasError: error !== null, errorId, ref: inputRef })}
      {error !== null && (
        <p id={errorId} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
