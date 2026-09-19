import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from 'cn'
import { Eye, GripVertical, Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import { useDragBodyClass } from '@/hooks/useDragBodyClass'
import { useEscapeWhenUnfocused } from '@/hooks/useEscapeWhenUnfocused'
import { useOptimisticValue } from '@/hooks/useOptimisticValue'
import { mutedPlaceholder } from '@/lib/format'
import { addProgramDance, removeProgramDance, reorderProgramDances } from '@/lib/powersync/commitProgramDanceReorder'
import { useDances } from '@/routes/dances/DancesPage.data'
import { renumberSequentially } from './programDanceOrder'
import type { DragEndEvent } from '@dnd-kit/core'
import type { ProgramDance } from './ProgramsPage.columns'

interface DanceOption {
  id: string
  label: string
}

// A program's ordered dance lineup - a numbered-link list in view mode;
// edit mode adds drag-to-reorder, a remove button per row, and an "Add
// dance" search (and drops the numbers).
export function ProgramDanceLineup({ programId, dances }: { programId: string; dances: ProgramDance[] }) {
  const [isEditing, setIsEditing] = useState(false)

  // Escape while nothing on the page has focus leaves edit mode - like
  // clicking the toggle back to Eye, not a discard of anything (every
  // reorder/add/remove already autosaves), so there's nothing to lose.
  useEscapeWhenUnfocused(() => setIsEditing(false), isEditing)

  const [displayDances, setOptimisticDances] = useOptimisticValue(dances)

  function handleReorder(newDances: ProgramDance[]) {
    // newDances is just arrayMove()'d, so it's renumbered once here -
    // reorderProgramDances just persists these same values.
    const renumbered = renumberSequentially(newDances)
    setOptimisticDances(renumbered)
    void reorderProgramDances(renumbered)
  }

  function handleRemove(programDanceId: string) {
    const remaining = renumberSequentially(displayDances.filter((dance) => dance.programDanceId !== programDanceId))
    setOptimisticDances(remaining)
    void removeProgramDance(programDanceId, remaining)
  }

  async function handleAdd(danceId: string, title: string) {
    // The max, not the last item's own order, or a gap in a legacy
    // program's order values (see programDancesSubquery's comment) could
    // put the new dance ahead of the current last one once re-sorted.
    const order = Math.max(0, ...displayDances.map((dance) => dance.order)) + 1
    const programDanceId = await addProgramDance(programId, danceId, order)
    setOptimisticDances([...displayDances, { programDanceId, danceId, order, title }])
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">Dances</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label={isEditing ? 'Done editing dances' : 'Edit dances'}
          onClick={() => setIsEditing((current) => !current)}
        >
          {isEditing ? <Eye className="size-4" /> : <Pencil className="size-4" />}
        </Button>
      </div>
      <div className="mt-1">
        {isEditing ? (
          <EditableDanceLineup
            dances={displayDances}
            onReorder={handleReorder}
            onRemove={handleRemove}
            onAdd={(danceId, title) => void handleAdd(danceId, title)}
          />
        ) : (
          <ReadOnlyDanceLineup dances={displayDances} />
        )}
      </div>
    </div>
  )
}

function ReadOnlyDanceLineup({ dances }: { dances: ProgramDance[] }) {
  if (dances.length === 0) return <div className="py-3">{mutedPlaceholder}</div>
  return (
    <ol className="space-y-0.5 py-3">
      {dances.map((dance) => (
        <li key={dance.programDanceId} className="flex min-h-7 items-center">
          <span className="mr-4 w-5 shrink-0 text-right tabular-nums text-muted-foreground">{dance.order}</span>
          <Link to={`/dances/${dance.danceId}`} className="min-w-0 truncate hover:underline">
            {dance.title}
          </Link>
        </li>
      ))}
    </ol>
  )
}

function EditableDanceLineup({
  dances,
  onReorder,
  onRemove,
  onAdd,
}: {
  dances: ProgramDance[]
  onReorder: (dances: ProgramDance[]) => void
  onRemove: (programDanceId: string) => void
  onAdd: (danceId: string, title: string) => void
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

    const oldIndex = dances.findIndex((dance) => dance.programDanceId === active.id)
    const newIndex = dances.findIndex((dance) => dance.programDanceId === over.id)
    onReorder(arrayMove(dances, oldIndex, newIndex))
  }

  return (
    <div>
      {dances.length === 0 ? (
        <div className="pt-3 pb-1">{mutedPlaceholder}</div>
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
          <SortableContext items={dances.map((dance) => dance.programDanceId)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-0.5 pt-3 pb-1">
              {dances.map((dance) => (
                <DanceLineupRow key={dance.programDanceId} dance={dance} onRemove={() => onRemove(dance.programDanceId)} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
      <AddDanceCombobox excludeDanceIds={dances.map((dance) => dance.danceId)} onAdd={onAdd} />
    </div>
  )
}

function DanceLineupRow({ dance, onRemove }: { dance: ProgramDance; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dance.programDanceId })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 rounded-lg hover:bg-muted/50"
    >
      <button
        type="button"
        aria-label="Reorder dance"
        className={cn(
          'inline-flex size-7 shrink-0 touch-none items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Link to={`/dances/${dance.danceId}`} className="min-w-0 truncate hover:underline">
        {dance.title}
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Remove dance"
        className="ml-auto shrink-0 text-muted-foreground"
        onClick={onRemove}
      >
        <X className="size-4" />
      </Button>
    </li>
  )
}

function AddDanceCombobox({ excludeDanceIds, onAdd }: { excludeDanceIds: string[]; onAdd: (danceId: string, title: string) => void }) {
  const { dances: allDances } = useDances()
  const [isAdding, setIsAdding] = useState(false)

  if (!isAdding) {
    return (
      <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => setIsAdding(true)}>
        <Plus /> Add dance
      </Button>
    )
  }

  const options: DanceOption[] = allDances
    .filter((dance) => !excludeDanceIds.includes(dance.id))
    .map((dance) => ({ id: dance.id, label: dance.title ?? '' }))

  return (
    <div className="mt-1">
      <Combobox
        items={options}
        itemToStringLabel={(option: DanceOption) => option.label}
        isItemEqualToValue={(a: DanceOption, b: DanceOption) => a.id === b.id}
        onValueChange={(option: DanceOption | null) => {
          if (option) onAdd(option.id, option.label)
          setIsAdding(false)
        }}
        onOpenChange={(open) => {
          if (!open) setIsAdding(false)
        }}
        defaultOpen
      >
        <ComboboxInput autoFocus placeholder="Search dances…" showClear />
        <ComboboxContent>
          <ComboboxEmpty>No matching dances</ComboboxEmpty>
          <ComboboxList>
            {(option: DanceOption) => (
              <ComboboxItem key={option.id} value={option}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
