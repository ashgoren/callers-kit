import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from 'cn'
import { GripVertical, Plus, X } from 'lucide-react'
import { EditableText } from '@/components/fields/EditableText'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDragBodyClass } from '@/hooks/useDragBodyClass'
import { mutedPlaceholder } from '@/lib/format'
import { appendVideo, removeVideoItem, updateVideoItem, videoUrlSchema } from '@/lib/videos'
import type { DragEndEvent } from '@dnd-kit/core'
import type { Video } from '@/lib/videos'

// A controlled list editor for a dance's videos - reorder/add/remove/edit
// all flow through one onChange(items) callback, same contract as
// FiguresList, so the caller decides whether each change commits
// immediately only stages into a local draft until Save.
export function VideosList({ items, onChange }: { items: Video[]; onChange: (items: Video[]) => void }) {
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
            <div className="grid grid-cols-[auto_minmax(auto,20rem)_minmax(10rem,1fr)_auto] gap-x-2">
              {items.map((item) => (
                <VideoRow
                  key={item.id}
                  item={item}
                  onChange={(patch) => onChange(updateVideoItem(items, item.id, patch))}
                  onRemove={() => onChange(removeVideoItem(items, item.id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <div className="mt-3 flex pt-3">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(appendVideo(items))}>
          <Plus /> Add video
        </Button>
      </div>
    </div>
  )
}

function VideoRow({ item, onChange, onRemove }: {
  item: Video
  onChange: (patch: Partial<Video>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  // col-span-full + grid-cols-subgrid: this row is one real element (needed
  // for dnd-kit's ref/transform) that still shares the parent grid's own
  // fixed column tracks rather than defining its own.
  const rowRef = { ref: setNodeRef, style: { transform: CSS.Transform.toString(transform), transition } }

  return (
    <div {...rowRef} className="col-span-full grid grid-cols-subgrid items-start rounded-lg py-1 hover:bg-muted/50">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Reorder video"
              className={cn(
                'inline-flex h-[calc(1lh+0.5rem+2px)] touch-none items-center justify-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                isDragging ? 'cursor-grabbing' : 'cursor-grab',
              )}
              {...attributes}
              {...listeners}
              tabIndex={-1} // Overriding dnd-kit's own default tabIndex={0} keeps it out of the tab order.
            />
          }
        >
          <GripVertical className="size-4" />
        </TooltipTrigger>
        <TooltipContent>Reorder video</TooltipContent>
      </Tooltip>
      <EditableText
        value={item.description}
        onCommit={(value) => onChange({ description: value })}
        placeholder="Description"
        className="min-w-0 truncate"
        fullWidth
      />
      <EditableText
        value={item.url}
        onCommit={(value) => onChange({ url: value })}
        schema={videoUrlSchema}
        placeholder="https://…"
        className="min-w-0 truncate"
        fullWidth
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove video"
              className="text-muted-foreground"
              onClick={onRemove}
            />
          }
        >
          <X className="size-4" />
        </TooltipTrigger>
        <TooltipContent>Remove video</TooltipContent>
      </Tooltip>
    </div>
  )
}
