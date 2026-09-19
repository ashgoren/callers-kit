import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import { buildCreatableComboboxItems, CREATE_OPTION_ID } from '@/lib/comboboxOptions'
import { mutedPlaceholder } from '@/lib/format'
import { commitRelationEdit } from '@/lib/powersync/commitRelationEdit'
import { createOwnerTableOption, useOwnerTableOptions } from '@/lib/powersync/useOwnerTableOptions'
import { InlineEditableField } from './InlineEditableField'
import type { ElementType, ReactNode } from 'react'
import type { ComboboxOption } from '@/lib/comboboxOptions'
import type { OwnerTableName } from '@/lib/powersync/useOwnerTableOptions'

export interface TagRef {
  id: string
  name: string | null
}

function defaultRenderDisplay(attached: TagRef[]): ReactNode {
  if (attached.length === 0) return mutedPlaceholder
  const sorted = [...attached].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((tag) => (
        <span key={tag.id} className="rounded-full border bg-muted px-2 py-0.5 text-xs">
          {tag.name}
        </span>
      ))}
    </div>
  )
}

// A multi-select, creatable combobox for a dance's many-to-many tag
// relations (choreographers, key moves, vibes) - pick from this user's
// existing tags, or type a new name and confirm "Create" to add it and
// attach it in one step. The single-select sibling is
// EditableLocationCombobox; this one differs in one structural way that
// matters: there is no single committed "value" here to hold as a draft -
// each chip add/remove is its own immediate commit against the live set
// PowerSync already reflects (via commitRelationEdit), not a value swap.
export function EditableTagCombobox({
  danceId,
  junctionTable,
  refIdColumn,
  ownerTable,
  value,
  as,
  className,
  placeholder,
  renderDisplay = defaultRenderDisplay,
}: {
  danceId: string
  junctionTable: string
  refIdColumn: string
  ownerTable: OwnerTableName
  value: TagRef[]
  as?: ElementType
  className?: string
  placeholder?: string
  renderDisplay?: (attached: TagRef[]) => ReactNode
}) {
  const { options: ownerRows } = useOwnerTableOptions(ownerTable)
  const [isFocused, setIsFocused] = useState(false)
  const [query, setQuery] = useState('')
  // Tracks whether an item is currently highlighted via arrow-key nav / hover -
  // same reasoning as EditableLocationCombobox's own.
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const anchor = useComboboxAnchor()

  const attachedIds = value.map((tag) => tag.id)
  const [optimisticIds, setOptimisticIds] = useState<string[] | null>(null)
  if (optimisticIds !== null && JSON.stringify([...attachedIds].sort()) === JSON.stringify([...optimisticIds].sort())) {
    setOptimisticIds(null)
  }
  const liveIds = optimisticIds ?? attachedIds

  const options: ComboboxOption[] = ownerRows.map((row) => ({ id: row.id, label: row.name ?? '' }))
  const optionsByID = new Map(options.map((option) => [option.id, option.label]))
  const items = buildCreatableComboboxItems(options, query, liveIds)

  // Closes after any add or removal, unless it left an empty set.
  async function applyChange(nextIds: string[]) {
    const addedIds = nextIds.filter((id) => !liveIds.includes(id))
    const removedIds = liveIds.filter((id) => !nextIds.includes(id))

    if (addedIds.includes(CREATE_OPTION_ID)) {
      const newId = await createOwnerTableOption(ownerTable, query.trim())
      setOptimisticIds(nextIds.map((id) => (id === CREATE_OPTION_ID ? newId : id)))
      await commitRelationEdit(junctionTable, refIdColumn, danceId, newId, 'add')
      setIsFocused(false)
      return
    }

    setOptimisticIds(nextIds)
    for (const id of addedIds) {
      await commitRelationEdit(junctionTable, refIdColumn, danceId, id, 'add')
    }
    for (const id of removedIds) {
      await commitRelationEdit(junctionTable, refIdColumn, danceId, id, 'remove')
    }
    if (addedIds.length > 0 || (removedIds.length > 0 && nextIds.length > 0)) {
      setIsFocused(false)
    }
  }

  return (
    <InlineEditableField
      draft={liveIds}
      error={null}
      isFocused={isFocused}
      onFocus={() => {
        setQuery('')
        setHighlightedId(null)
        setIsFocused(true)
      }}
      onChange={(next) => void applyChange(next)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={() => {
        // Combobox handles its own keyboard interaction.
      }}
      as={as}
      className={className}
      renderDisplay={(ids) => renderDisplay(value.filter((tag) => ids.includes(tag.id)))}
      renderInput={({ draft, onChange, onBlur }) => (
        // Escape and Enter are both fully owned here, same reasoning as EditableLocationCombobox's
        // own capture-phase handler: Base UI's own Escape handling, once the popup is already closed,
        // clears the *entire* selected array for a multiple-mode combobox - a race here would
        // silently detach every attached tag.
        <div
          onKeyDownCapture={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              onBlur()
              return
            }
            if (event.key === 'Enter' && highlightedId === null) {
              event.stopPropagation()
              event.preventDefault()
              const exactMatch = options.find(
                (option) => option.label.toLowerCase() === query.trim().toLowerCase() && !draft.includes(option.id),
              )
              // No match at all is a plain no-op, same as the single-select
              // field - there's nothing to revert either way, since every
              // add/remove already commits immediately as it happens rather
              // than waiting on a close to finalize anything.
              if (exactMatch) void applyChange([...draft, exactMatch.id])
              setQuery('')
            }
          }}
        >
          <Combobox
            multiple
            items={items.map((item) => item.id)}
            filter={null}
            value={draft}
            onValueChange={onChange}
            inputValue={query}
            onInputValueChange={setQuery}
            onItemHighlighted={(highlighted) => setHighlightedId(highlighted ?? null)}
            itemToStringLabel={(id) => (id === CREATE_OPTION_ID ? query.trim() : (optionsByID.get(id) ?? ''))}
            defaultOpen
            onOpenChange={(open) => {
              if (!open) onBlur()
            }}
          >
            <ComboboxChips ref={anchor}>
              <ComboboxValue>
                {(ids: string[]) => (
                  <>
                    {ids.map((id) => (
                      <ComboboxChip key={id}>{optionsByID.get(id) ?? id}</ComboboxChip>
                    ))}
                    <ComboboxChipsInput autoFocus placeholder={ids.length === 0 ? placeholder : undefined} />
                  </>
                )}
              </ComboboxValue>
            </ComboboxChips>
            <ComboboxContent anchor={anchor}>
              <ComboboxEmpty>No options yet</ComboboxEmpty>
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
