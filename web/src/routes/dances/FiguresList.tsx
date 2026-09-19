import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from 'cn'
import { GripVertical, Plus, X } from 'lucide-react'
import { Fragment } from 'react'
import { EditableFigureText } from '@/components/fields/EditableFigureText'
import { EditableNumber } from '@/components/fields/EditableNumber'
import { EditableText } from '@/components/fields/EditableText'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useDragBodyClass } from '@/hooks/useDragBodyClass'
import { useOptimisticValue } from '@/hooks/useOptimisticValue'
import { appendFigure, appendNote, isFigureEntry, removeFigureItem, updateFigureItem, withComputedPhrases } from '@/lib/figures'
import { mutedPlaceholder } from '@/lib/format'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import type { DragEndEvent } from '@dnd-kit/core'
import type { Editor } from '@tiptap/react'
import type { FigureEntry, FigureItem, NoteEntry } from '@/lib/figures'
import type { PhraseSpan } from '@/lib/phraseSkeleton'

// Same styling as the editable fields
const FIELD_BOX_CLASSES = 'block w-full rounded-lg border border-transparent px-2.5 py-1'

// Pairs each item with whether its phrase heading should show - a figure's
// phrase changing from the previous *figure* (an interspersed note doesn't
// count as a change, so a figure repeating the same phrase right after a
// note still suppresses the heading). Takes the already-computed phrase
// per item (see withComputedPhrases) rather than reading item.phrase
// itself, since that's only the right source in manual mode.
function withPhraseHeadings(
  rows: { item: FigureItem; phrase: string | null }[],
): { item: FigureItem; phrase: string | null; showPhraseHeading: boolean }[] {
  let lastPhrase: string | null = null
  return rows.map(({ item, phrase }) => {
    if (!isFigureEntry(item)) return { item, phrase, showPhraseHeading: false }
    const showPhraseHeading = phrase !== lastPhrase
    lastPhrase = phrase
    return { item, phrase, showPhraseHeading }
  })
}

export function FiguresList({ items, skeleton, manualPhrasing, isEditing, onChange, onToggleManualPhrasing, onActiveEditorChange }: {
  items: FigureItem[]
  skeleton: PhraseSpan[] | null
  manualPhrasing: boolean
  isEditing: boolean
  onChange: (items: FigureItem[]) => void
  onToggleManualPhrasing: (checked: boolean) => void
  onActiveEditorChange?: (editor: Editor | null) => void
}) {
  // Every commit here (reorder especially) is a PowerSync write that only
  // reaches this component's own `items` prop once the reactive query
  // round-trips and re-renders - a real gap, even for a local-only write.
  const [displayItems, setOptimisticItems] = useOptimisticValue(items)
  const [displayManualPhrasing, setOptimisticManualPhrasing] = useOptimisticValue(manualPhrasing)

  function handleChange(newItems: FigureItem[]) {
    setOptimisticItems(newItems)
    onChange(newItems)
  }

  function handleToggleManualPhrasing(checked: boolean) {
    setOptimisticManualPhrasing(checked)
    onToggleManualPhrasing(checked)
  }

  const phraseEditable = displayManualPhrasing || skeleton === null
  const rows = withPhraseHeadings(withComputedPhrases(displayItems, phraseEditable ? null : skeleton))

  if (!isEditing) {
    return <FiguresReadOnlyList rows={rows} />
  }

  return (
    <FiguresEditableList
      items={displayItems}
      rows={rows}
      skeleton={skeleton}
      manualPhrasing={displayManualPhrasing}
      phraseEditable={phraseEditable}
      onChange={handleChange}
      onToggleManualPhrasing={handleToggleManualPhrasing}
      onActiveEditorChange={onActiveEditorChange}
    />
  )
}

type FigureRowData = { item: FigureItem; phrase: string | null; showPhraseHeading: boolean }

function FiguresReadOnlyList({ rows }: { rows: FigureRowData[] }) {
  if (rows.length === 0) return mutedPlaceholder

  return (
    <div className="grid grid-cols-[auto_auto_1fr] gap-x-6 gap-y-0 text-base">
      {rows.map(({ item, phrase, showPhraseHeading }) => {
        if (!isFigureEntry(item)) {
          return (
            <Fragment key={item.id}>
              <div />
              <div />
              <div className="pt-3 text-muted-foreground italic" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.text) }} />
            </Fragment>
          )
        }

        return (
          <Fragment key={item.id}>
            <div className={cn('border-y border-transparent py-1 text-muted-foreground', showPhraseHeading && 'pt-3 font-semibold')}>
              {showPhraseHeading ? phrase : null}
            </div>
            <div className={cn('border-y border-transparent py-1 text-muted-foreground', showPhraseHeading && 'pt-3')}>
              {item.beats !== null ? `(${item.beats})` : null}
            </div>
            <div className={cn(showPhraseHeading && 'pt-3')} dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }} />
          </Fragment>
        )
      })}
    </div>
  )
}

function FiguresEditableList({ items, rows, skeleton, manualPhrasing, phraseEditable, onChange, onToggleManualPhrasing, onActiveEditorChange }: {
  items: FigureItem[]
  rows: FigureRowData[]
  skeleton: PhraseSpan[] | null
  manualPhrasing: boolean
  phraseEditable: boolean
  onChange: (items: FigureItem[]) => void
  onToggleManualPhrasing: (checked: boolean) => void
  onActiveEditorChange?: (editor: Editor | null) => void
}) {
  const [, setIsDraggingAnyRow] = useDragBodyClass()

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    setIsDraggingAnyRow(false)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)
    onChange(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <div>
      {/* Only shown when a skeleton actually exists to toggle away from. */}
      {skeleton !== null && (
        <label className="mb-3 -mx-1.5 -my-1 inline-flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-muted-foreground hover:bg-muted/50">
          <Switch checked={manualPhrasing} onCheckedChange={onToggleManualPhrasing} />
          Manual phrasing
        </label>
      )}
      {items.length === 0 ? (
        <div className="pb-3">{mutedPlaceholder}</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={() => setIsDraggingAnyRow(true)}
          onDragCancel={() => setIsDraggingAnyRow(false)}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          autoScroll={false}
        >
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            {/* A shared grid, not independent per-row flex containers - every
                row opts into these same column tracks via subgrid rather than
                defining its own, so every row still stays one real DOM
                element for dnd-kit's ref/transform. Phrase/beats are fixed-width. */}
            <div className="grid grid-cols-[auto_3.5rem_3rem_1fr_auto] gap-x-2">
              {rows.map(({ item, phrase, showPhraseHeading }) => (
                <FigureRow
                  key={item.id}
                  item={item}
                  phrase={phrase}
                  showPhraseHeading={showPhraseHeading}
                  phraseEditable={phraseEditable}
                  onChange={(patch) => onChange(updateFigureItem(items, item.id, patch))}
                  onRemove={() => onChange(removeFigureItem(items, item.id))}
                  onActiveEditorChange={onActiveEditorChange}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <div className="mt-3 flex gap-2 pt-3">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(appendFigure(items, skeleton))}>
          <Plus /> Add figure
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(appendNote(items))}>
          <Plus /> Add note
        </Button>
      </div>
    </div>
  )
}

function FigureRow({ item, phrase, showPhraseHeading, phraseEditable, onChange, onRemove, onActiveEditorChange }: {
  item: FigureItem
  phrase: string | null
  showPhraseHeading: boolean
  phraseEditable: boolean
  onChange: (patch: Partial<FigureEntry> | Partial<NoteEntry>) => void
  onRemove: () => void
  onActiveEditorChange?: (editor: Editor | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const dragHandle = (
    <button
      type="button"
      aria-label={isFigureEntry(item) ? 'Reorder figure' : 'Reorder note'}
      className={cn(
        // h-[calc(1lh+0.5rem+2px)]: the same height formula editable fields use.
        'inline-flex h-[calc(1lh+0.5rem+2px)] touch-none items-center justify-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  )

  const removeButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={isFigureEntry(item) ? 'Remove figure' : 'Remove note'}
      className="text-muted-foreground"
      onClick={onRemove}
    >
      <X className="size-4" />
    </Button>
  )

  // col-span-full + grid-cols-subgrid: this row is one real element (needed
  // for dnd-kit's ref/transform) that still shares the parent grid's own
  // fixed column tracks rather than defining its own, so phrase/beats stay
  // aligned down the whole list regardless of any individual row's content.
  const rowRef = { ref: setNodeRef, style: { transform: CSS.Transform.toString(transform), transition } }

  if (!isFigureEntry(item)) {
    return (
      <div {...rowRef} className="col-span-full grid grid-cols-subgrid items-start rounded-lg pt-3 hover:bg-muted/50">
        {dragHandle}
        <div />
        <div />
        <div className="min-w-0 text-muted-foreground italic">
          <EditableFigureText
            value={item.text}
            onCommit={(value) => onChange({ text: value ?? '' })}
            onActiveChange={onActiveEditorChange}
            placeholder="Add a note…"
          />
        </div>
        {removeButton}
      </div>
    )
  }

  return (
    <div {...rowRef} className={cn('col-span-full grid grid-cols-subgrid items-start rounded-lg hover:bg-muted/50', showPhraseHeading ? 'pt-3' : 'pt-1')}>
      {dragHandle}
      <div className="overflow-hidden text-muted-foreground">
        {showPhraseHeading &&
          (phraseEditable ? (
            <EditableText value={phrase ?? ''} onCommit={(value) => onChange({ phrase: value })} className="font-semibold" fullWidth />
          ) : (
            <span className={cn(FIELD_BOX_CLASSES, 'font-semibold')}>{phrase}</span>
          ))}
      </div>
      <div className="text-muted-foreground">
        <EditableNumber value={item.beats} onCommit={(value) => onChange({ beats: value })} min={0} />
      </div>
      <div className="min-w-0">
        <EditableFigureText
          value={item.description}
          onCommit={(value) => onChange({ description: value ?? '' })}
          onActiveChange={onActiveEditorChange}
          placeholder="Add a figure…"
        />
      </div>
      {removeButton}
    </div>
  )
}
