import { cn } from 'cn'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSelectFieldEdit } from '@/hooks/useSelectFieldEdit'
import { mutedPlaceholder } from '@/lib/format'
import { InlineEditableField } from './InlineEditableField'
import type { ElementType } from 'react'

// A fixed-vocabulary inline-editable field - a read-only display until
// clicked/tapped, then a real Select, opened immediately (defaultOpen) so
// one click both reveals the control and offers the choice, the same
// immediacy a click into EditableText/EditableNumber already gives you.
// formatLabel is separate from the stored value because a couple of these
// vocabularies (formation, notably) store a longer canonical string than
// what's shown - e.g. "Duple Minor - Becket" is stored, but only "Becket"
// is displayed, in both the closed display and every option in the list.
export function EditableSelect({ value, onCommit, options, formatLabel, as, className }: {
  value: string | null
  onCommit: (value: string | null) => void
  options: string[]
  formatLabel?: (value: string) => string
  as?: ElementType
  className?: string
}) {
  const fieldEdit = useSelectFieldEdit({ value, onCommit })
  const format = formatLabel ?? ((v: string) => v)

  return (
    <InlineEditableField
      {...fieldEdit}
      as={as}
      className={className}
      renderDisplay={(v) => (v === null ? mutedPlaceholder : format(v))}
      renderInput={({ draft, onChange, onBlur }) => (
        <Select
          value={draft}
          onValueChange={onChange}
          defaultOpen
          onOpenChange={(open) => {
            if (!open) onBlur()
          }}
        >
          <SelectTrigger className={cn('h-[calc(1lh+0.5rem+2px)]', className)}>
            <SelectValue>{(v: string | null) => (v === null ? mutedPlaceholder : format(v))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {format(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  )
}
