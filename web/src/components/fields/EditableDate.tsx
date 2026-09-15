import { cn } from 'cn'
import { Input } from '@/components/ui/input'
import { useDraftFieldEdit } from '@/hooks/useDraftFieldEdit'
import { formatDate } from '@/lib/format'
import { InlineEditableField } from './InlineEditableField'
import type { ElementType, RefObject } from 'react'
import type { z } from 'zod'

// A date inline-editable field - a read-only, human-formatted display until clicked/tapped,
// then a real native date input. Its value is always a plain ISO "yyyy-MM-dd" string (or null, unset).
export function EditableDate({ value, onCommit, schema, placeholder = 'No date', as, className }: {
  value: string | null
  onCommit: (value: string | null) => void
  schema?: z.ZodType<string | null>
  placeholder?: string
  as?: ElementType
  className?: string
}) {
  const fieldEdit = useDraftFieldEdit({ value, onCommit, schema })

  return (
    <InlineEditableField
      {...fieldEdit}
      as={as}
      className={className}
      renderDisplay={(v) => (v === null ? <span className="text-muted-foreground">{placeholder}</span> : formatDate(v))}
      renderInput={({ draft, onChange, onBlur, onKeyDown, hasError, errorId, ref }) => (
        <Input
          ref={ref as RefObject<HTMLInputElement | null>}
          type="date"
          autoFocus
          value={draft ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={cn(
            // w-76: sized for this field's one current caller - program date (text-4xl).
            // field-sizing-content was tried here but made the box too wide in practice.
            'h-[calc(1lh+0.5rem+2px)] w-76 overflow-hidden dark:[&::-webkit-calendar-picker-indicator]:invert',
            className,
          )}
        />
      )}
    />
  )
}
