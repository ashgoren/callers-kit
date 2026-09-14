import { cn } from 'cn'
import { useId } from 'react'
import { useFieldEdit } from '@/hooks/useFieldEdit'
import type { ElementType, KeyboardEvent, ReactNode } from 'react'
import type { z } from 'zod'

// The shared "click (or tap) to edit" shell every Editable* field builds on:
// a read-mode display that swaps to a real input once activated, rather
// than disguising an always-present input as plain text. Read mode keeps
// whatever semantic element the caller needs (a real <h1> for a page title,
// say) - the swap to an actual input only happens once genuinely editing,
// so there's nothing fighting the input's own preset styling to make it
// look like something else.
export function InlineEditableField<T>({
  value,
  onCommit,
  schema,
  as: As = 'span',
  className,
  renderDisplay,
  renderInput,
}: {
  value: T
  onCommit: (value: T) => void
  schema?: z.ZodType<T>
  as?: ElementType
  className?: string
  renderDisplay: (value: T) => ReactNode
  renderInput: (props: {
    draft: T
    onChange: (value: T) => void
    onBlur: () => void
    onKeyDown: (e: KeyboardEvent) => void
    hasError: boolean
    errorId: string
  }) => ReactNode
}) {
  const { draft, error, isFocused, onFocus, onChange, onBlur, onKeyDown } = useFieldEdit({ value, onCommit, schema })
  const errorId = useId()

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
        // inline-block: shrinks the hover/click target to the content
        // itself, rather than a block element's default full-container
        // width. border-transparent (not border-0/no border) + the same
        // px-2.5 py-1 padding Input itself uses: border-*width* and padding
        // never change between this and the actual input it swaps to, so
        // the box is exactly the same height in both states.
        className={cn(
          'inline-block cursor-pointer rounded-lg border border-transparent px-2.5 py-1 hover:bg-muted/50',
          className,
        )}
      >
        {renderDisplay(draft)}
      </As>
    )
  }

  return (
    <div>
      {renderInput({ draft, onChange, onBlur, onKeyDown, hasError: error !== null, errorId })}
      {error !== null && (
        <p id={errorId} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
