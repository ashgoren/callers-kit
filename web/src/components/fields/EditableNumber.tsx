import { cn } from 'cn'
import { NumberField, NumberFieldInput } from '@/components/ui/number-field'
import { useDraftFieldEdit } from '@/hooks/useDraftFieldEdit'
import { mutedPlaceholder } from '@/lib/format'
import { InlineEditableField } from './InlineEditableField'
import type { ElementType, RefObject } from 'react'
import type { z } from 'zod'

// A numeric inline-editable field - a read-only display until clicked/
// tapped, then a real NumberField. Unlike EditableText, this doesn't need
// the ghost-sizing grid trick: a difficulty rating (or any similarly-scoped
// number) is always short enough that a small fixed width comfortably fits
// it, so there's no real content-width to track. null is a value in its own
// right here (unset), not coalesced away the way title's NOT NULL column
// coalesces to an empty string - so both the display and the schema need to
// account for it directly.
export function EditableNumber({ value, onCommit, schema, as, className }: {
  value: number | null
  onCommit: (value: number | null) => void
  schema?: z.ZodType<number | null>
  as?: ElementType
  className?: string
}) {
  const fieldEdit = useDraftFieldEdit({ value, onCommit, schema })

  return (
    <InlineEditableField
      {...fieldEdit}
      as={as}
      className={className}
      renderDisplay={(v) => (v === null ? mutedPlaceholder : v)}
      renderInput={({ draft, onChange, onBlur, onKeyDown, hasError, errorId, ref }) => (
        <NumberField value={draft} onValueChange={onChange} className={cn('inline-block w-12', className)}>
          <NumberFieldInput
            ref={ref as RefObject<HTMLInputElement | null>}
            autoFocus
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            className={cn('h-[calc(1lh+0.5rem+2px)] w-full overflow-hidden', className)}
          />
        </NumberField>
      )}
    />
  )
}
