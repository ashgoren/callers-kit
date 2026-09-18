import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import { useSelectFieldEdit } from '@/hooks/useSelectFieldEdit'
import { buildCreatableComboboxItems, CREATE_OPTION_ID } from '@/lib/comboboxOptions'
import { mutedPlaceholder } from '@/lib/format'
import { createLocation, useLocations } from '@/lib/powersync/useLocations'
import { InlineEditableField } from './InlineEditableField'
import type { ElementType } from 'react'
import type { ComboboxOption } from '@/lib/comboboxOptions'

// A single-select, creatable combobox for Program.location_id - pick one of
// this user's existing locations, or type a name with no match and confirm
// "Create '<name>'" to add it and select it in one step.
//
// Reuses useSelectFieldEdit as-is: picking a value (an existing location id
// or a freshly created one) is still just an immediate commit - the async
// create-then-commit step below happens before onChange is ever called, not
// inside the commit model itself.
export function EditableLocationCombobox({ value, onCommit, as, className }: {
  value: string | null
  onCommit: (value: string | null) => void
  as?: ElementType
  className?: string
}) {
  const { locations } = useLocations()
  const fieldEdit = useSelectFieldEdit({ value, onCommit })
  const [query, setQuery] = useState('')

  const options: ComboboxOption[] = locations.map((location) => ({ id: location.id, label: location.name ?? '' }))
  const optionsByID = new Map(options.map((option) => [option.id, option.label]))
  const items = buildCreatableComboboxItems(options, query, fieldEdit.draft)

  async function handleValueChange(next: string | null) {
    if (next !== CREATE_OPTION_ID) {
      fieldEdit.onChange(next)
      return
    }
    const id = await createLocation(query.trim())
    fieldEdit.onChange(id)
  }

  return (
    <InlineEditableField
      {...fieldEdit}
      onFocus={() => {
        setQuery('')
        fieldEdit.onFocus()
      }}
      as={as}
      className={className}
      renderDisplay={(v) => (v === null ? mutedPlaceholder : (optionsByID.get(v) ?? mutedPlaceholder))}
      renderInput={({ draft, onBlur }) => (
        <div
          onKeyDownCapture={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              onBlur()
              return
            }
            // Base UI's own Enter handling only confirms a highlighted item,
            // but if the user has typed a name that already exactly matches an
            // existing location, commit that one outright on Enter.
            if (event.key === 'Enter') {
              const exactMatch = options.find((option) => option.label.toLowerCase() === query.trim().toLowerCase())
              if (exactMatch) {
                event.stopPropagation()
                event.preventDefault()
                void handleValueChange(exactMatch.id)
                onBlur()
              }
            }
          }}
        >
          <Combobox
            items={items.map((item) => item.id)}
            filter={null}
            value={draft}
            onValueChange={(next) => void handleValueChange(next)}
            inputValue={query}
            onInputValueChange={setQuery}
            itemToStringLabel={(id) => (id === CREATE_OPTION_ID ? query.trim() : (optionsByID.get(id) ?? ''))}
            defaultOpen
            onOpenChange={(open) => {
              if (!open) onBlur()
            }}
          >
            <ComboboxInput autoFocus placeholder="Choose or create a location" showClear />
            <ComboboxContent>
              <ComboboxEmpty>No locations yet</ComboboxEmpty>
              <ComboboxList>
                {(id: string) => (
                  <ComboboxItem key={id} value={id}>
                    {id === CREATE_OPTION_ID ? (
                      <>
                        <PlusIcon className="size-4" />
                        {`Create "${query.trim()}"`}
                      </>
                    ) : (
                      optionsByID.get(id)
                    )}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      )}
    />
  )
}
