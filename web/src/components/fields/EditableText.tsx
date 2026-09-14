import { cn } from 'cn'
import { Input } from '@/components/ui/input'
import { InlineEditableField } from './InlineEditableField'
import type { ElementType } from 'react'
import type { z } from 'zod'

// A plain text inline-editable field - a read-only display (whatever tag
// `as` specifies) until clicked/tapped, then a real Input.
export function EditableText({
  value,
  onCommit,
  schema,
  placeholder,
  as,
  className,
}: {
  value: string
  onCommit: (value: string) => void
  schema?: z.ZodType<string>
  placeholder?: string
  as?: ElementType
  className?: string
}) {
  return (
    <InlineEditableField
      value={value}
      onCommit={onCommit}
      schema={schema}
      as={as}
      className={className}
      renderDisplay={(v) => v || (placeholder && <span className="text-muted-foreground">{placeholder}</span>)}
      renderInput={({ draft, onChange, onBlur, onKeyDown, hasError, errorId }) => (
        // The input's box grows/shrinks to fit the current text, rather
        // than spanning its full container - an invisible ::after copy of
        // the draft (kept in sync via data-value) is stacked in the same
        // grid cell as the real input, and drives the inline-grid wrapper's
        // column track width. The input itself gets w-0 min-w-full, not
        // w-full: a percentage width still lets a native <input> contribute
        // its own default browser intrinsic width (~20 characters) to the
        // grid's auto track-sizing, which is wider than the actual text -
        // w-0 removes that contribution entirely, and min-w-full then
        // stretches it to whatever width the ghost alone ends up driving.
        // after:pl-2.5 mirrors Input's own horizontal padding (input.tsx) so
        // the reserved space accounts for it too - these two have to be kept
        // in sync by hand if that padding ever changes. after:pr-3, not
        // after:pr-2.5: a native <input> renders its text in ~2px less
        // space than an equivalent span/div does (measured empirically via
        // DevTools) - likely internal caret/text-rendering reservation a
        // plain element never needs - so the ghost's right padding carries
        // 2px of slack to compensate, or the box ends up very slightly
        // narrower than the input actually needs.
        <div
          data-value={draft || placeholder || ''}
          className={cn(
            "inline-grid after:invisible after:col-start-1 after:row-start-1 after:min-w-[2ch] after:content-[attr(data-value)] after:whitespace-pre after:pl-2.5 after:pr-3",
            className,
          )}
        >
          <Input
            autoFocus
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            // h-[calc(1lh+...)], not h-auto: a native <input>'s own "auto"
            // height comes from the browser's form-control sizing
            // heuristic, which (measured empirically) doesn't precisely
            // track an arbitrary font-size - it fell ~3px short at
            // text-4xl, leaving that much real internal scroll room for a
            // wheel/trackpad gesture to nudge the text within its own box.
            // 1lh sidesteps that heuristic entirely: it's "this element's
            // own computed line-height," the same font-metric math a plain
            // text element (the read-mode display) already uses correctly
            // - so this works for any field's font-size, not just this
            // one. +0.5rem +2px account for Input's own py-1 and border.
            // overflow-hidden is still worth keeping as a backstop even so
            // - this box is deliberately sized to exactly fit its content,
            // so there's never anything legitimate to scroll to.
            className={cn(
              'col-start-1 row-start-1 h-[calc(1lh+0.5rem+2px)] w-0 min-w-full overflow-hidden',
              className,
            )}
          />
        </div>
      )}
    />
  )
}
