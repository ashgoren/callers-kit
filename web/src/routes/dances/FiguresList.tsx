import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from 'cn'
import { GripVertical, Plus, X } from 'lucide-react'
import { EditableFigureText } from '@/components/fields/EditableFigureText'
import { EditableNumber } from '@/components/fields/EditableNumber'
import { EditableText } from '@/components/fields/EditableText'
import { Button } from '@/components/ui/button'
import { useDragBodyClass } from '@/hooks/useDragBodyClass'
import { appendFigure, appendNote, isFigureEntry, removeFigureItem, updateFigureItem, withComputedPhrases } from '@/lib/figures'
import { mutedPlaceholder } from '@/lib/format'
import type { DragEndEvent } from '@dnd-kit/core'
import type { Editor } from '@tiptap/react'
import type { FigureEntry, FigureItem, NoteEntry } from '@/lib/figures'
import type { PhraseSpan } from '@/lib/phraseSkeleton'

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

// One dance version's figures list, editable end to end: reorder via
// drag handle, add/remove lines, edit beats, and edit phrase (only when
// phrasing is manual). Every mutation computes the next full array and
// hands it to onChange in one shot, mirroring how the array is stored.
export function FiguresList({ items, skeleton, manualPhrasing, onChange, onActiveEditorChange }: {
  items: FigureItem[]
  skeleton: PhraseSpan[] | null
  manualPhrasing: boolean
  onChange: (items: FigureItem[]) => void
  onActiveEditorChange?: (editor: Editor | null) => void
}) {
  const [, setIsDraggingAnyRow] = useDragBodyClass()

  const phraseEditable = manualPhrasing || skeleton === null
  const rows = withPhraseHeadings(withComputedPhrases(items, phraseEditable ? null : skeleton))

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
          </SortableContext>
        </DndContext>
      )}
      <div className="mt-3 flex gap-2 border-t pt-3">
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
        'shrink-0 touch-none rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
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
      className="shrink-0 text-muted-foreground"
      onClick={onRemove}
    >
      <X className="size-4" />
    </Button>
  )

  if (!isFigureEntry(item)) {
    return (
      <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex items-start gap-2 pt-3">
        {dragHandle}
        <div className="min-w-0 flex-1 text-muted-foreground italic">
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
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-start gap-2', showPhraseHeading ? 'pt-3' : 'pt-1')}
    >
      {dragHandle}
      <div className="w-8 shrink-0 pt-1 text-muted-foreground">
        {showPhraseHeading &&
          (phraseEditable ? (
            <EditableText value={phrase ?? ''} onCommit={(value) => onChange({ phrase: value })} className="font-semibold" />
          ) : (
            <span className="font-semibold">{phrase}</span>
          ))}
      </div>
      <div className="w-10 shrink-0 pt-1 text-muted-foreground">
        <EditableNumber value={item.beats} onCommit={(value) => onChange({ beats: value })} min={0} />
      </div>
      <div className="min-w-0 flex-1">
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
