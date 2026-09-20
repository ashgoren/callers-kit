import { cn } from 'cn'
import { Input } from '@/components/ui/input'
import { useDraftFieldEdit } from '@/hooks/useDraftFieldEdit'
import { InlineEditableField } from './InlineEditableField'
import type { ElementType, ReactNode, RefObject } from 'react'
import type { z } from 'zod'

// A plain text inline-editable field - a read-only display until
// clicked/tapped, then a real Input. Two layout modes, chosen via
// fullWidth : content-sized, hugging its own text inline
// or filling whatever fixed-width container it's placed in.
//
// Full-width mode is an ordinary Input filling its container via w-full.
//
// Content-sized mode's box sizes to fit the current text instead of
// spanning its container: an invisible ::after copy of the draft (kept in
// sync via data-value) shares the wrapper's grid cell with the real input,
// and since neither sets an explicit width, the grid track sizes to
// whichever is wider - in practice always the ghost. The input itself
// needs w-0 min-w-full, not w-full: a percentage width still lets a native
// <input> contribute its own ~20-character intrinsic width to the track
// sizing, wider than the actual text. after:pr-3 (not pr-2.5, matching
// pl-2.5 and Input's own padding) carries a couple of extra pixels because
// a native input renders its text slightly narrower than an equivalent
// span does.
//
// Both modes use h-[calc(1lh+...)] for the input's height rather than
// h-auto: a native input's own "auto" height doesn't precisely track an
// arbitrary font-size, leaving a little real internal scroll room.
export function EditableText({ value, onCommit, schema, placeholder, as, className, fullWidth, renderDisplay }: {
  value: string
  onCommit: (value: string) => void
  schema?: z.ZodType<string>
  placeholder?: string
  as?: ElementType
  className?: string
  fullWidth: boolean
  renderDisplay?: (value: string) => ReactNode  // optional override for how the value is shown in view mode
}) {
  const fieldEdit = useDraftFieldEdit({ value, onCommit, schema })

  return (
    <InlineEditableField
      {...fieldEdit}
      as={as}
      className={className}
      fullWidth={fullWidth}
      renderDisplay={(v) =>
        (renderDisplay ? renderDisplay(v) : v) || (placeholder && <span className="text-muted-foreground">{placeholder}</span>)
      }
      renderInput={({ draft, onChange, onBlur, onKeyDown, hasError, errorId, ref }) =>
        fullWidth ? (
          <Input
            ref={ref as RefObject<HTMLInputElement | null>}
            autoFocus
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            className={cn('h-[calc(1lh+0.5rem+2px)] w-full', className)}
          />
        ) : (
          <div
            data-value={draft || placeholder || ''}
            className={cn(
              "inline-grid after:invisible after:col-start-1 after:row-start-1 after:min-w-[2ch] after:content-[attr(data-value)] after:whitespace-pre after:pl-2.5 after:pr-3",
              className,
            )}
          >
            <Input
              ref={ref as RefObject<HTMLInputElement | null>}
              autoFocus
              value={draft}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              aria-invalid={hasError}
              aria-describedby={hasError ? errorId : undefined}
              className={cn(
                'col-start-1 row-start-1 h-[calc(1lh+0.5rem+2px)] w-0 min-w-full overflow-hidden',
                className,
              )}
            />
          </div>
        )
      }
    />
  )
}
