import { useEffect, useState } from 'react'
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pin, PinOff } from 'lucide-react'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { danceFields } from './DancesPage.columns'
import type { TableInstance } from './DancesPage.columns'
import { computeColumnReorder } from './DancesPage.reorder'

export function ColumnsMenu({ table }: { table: TableInstance }) {
  // Pinned and unpinned columns are two separate reorderable groups.
  const pinnedColumns = table.getPinnedLeafColumns('start') // left pinned columns
  const unpinnedColumns = table.getPinnedLeafColumns('center') // unpinned columns
  const pinnedIds = new Set(pinnedColumns.map((column) => column.id))

  // Restricts valid drop targets to whichever group (pinned/unpinned).
  const sameGroupCollisionDetection: CollisionDetection = (args) => {
    const activeIsPinned = pinnedIds.has(args.active.id as string)
    const sameGroupContainers = args.droppableContainers.filter(
      (container) => pinnedIds.has(container.id as string) === activeIsPinned,
    )
    return closestCenter({ ...args, droppableContainers: sameGroupContainers })
  }

  // Force grip pointer anywhere on screen while dragging.
  const [isDraggingAnyRow, setIsDraggingAnyRow] = useState(false)

  useEffect(() => {
    if (!isDraggingAnyRow) return
    document.body.classList.add('is-dragging-column')
    return () => document.body.classList.remove('is-dragging-column')
  }, [isDraggingAnyRow])

  function handleDragEnd(event: DragEndEvent) {
    setIsDraggingAnyRow(false)
    const { active, over } = event
    if (!over) return

    const result = computeColumnReorder(
      pinnedColumns.map((column) => column.id),
      unpinnedColumns.map((column) => column.id),
      active.id as string,
      over.id as string,
    )
    if (!result) return

    if ('pinnedIds' in result) {
      table.setColumnPinning((old) => ({ ...old, start: result.pinnedIds }))
    } else {
      table.setColumnOrder(result.unpinnedIds)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-md border px-2 py-1 text-sm hover:bg-muted">
        Columns
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DndContext
          sensors={useSensors(useSensor(PointerSensor))}
          collisionDetection={sameGroupCollisionDetection}
          onDragStart={() => setIsDraggingAnyRow(true)}
          onDragCancel={() => setIsDraggingAnyRow(false)}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          autoScroll={false}
        >
          <SortableContext items={pinnedColumns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
            <div>
              {pinnedColumns.map((column) => (
                <SortableColumnRow key={column.id} table={table} columnId={column.id} />
              ))}
            </div>
          </SortableContext>
          {pinnedColumns.length > 0 && <DropdownMenuSeparator />}
          <SortableContext items={unpinnedColumns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
            <div>
              {unpinnedColumns.map((column) => (
                <SortableColumnRow key={column.id} table={table} columnId={column.id} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Takes table + columnId rather than column object to fix a 2nd click bug.
function SortableColumnRow({ table, columnId }: { table: TableInstance; columnId: string }) {
  const column = table.getColumn(columnId)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: columnId })

  if (!column) return null

  const field = danceFields.find((danceField) => danceField.key === columnId)
  const label = field?.label ?? columnId
  const isPinned = column.getIsPinned() === 'start'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center"
    >
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        className={`shrink-0 touch-none rounded p-1 text-muted-foreground hover:bg-accent ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      {column.getCanHide() ? (
        <DropdownMenuCheckboxItem
          className="flex-1"
          checked={column.getIsVisible()}
          onCheckedChange={(checked) => column.toggleVisibility(checked)}
        >
          {label}
        </DropdownMenuCheckboxItem>
      ) : (
        // Title: no visibility toggle (see the columns menu tests), but
        // still needs the same label position as a real item so its pin
        // toggle lines up with everyone else's.
        <span className="flex-1 py-1 pl-1.5 text-sm">{label}</span>
      )}
      {column.getCanPin() && (
        <button
          type="button"
          aria-label={isPinned ? `Unpin ${label}` : `Pin ${label}`}
          aria-pressed={isPinned}
          onClick={() => column.pin(isPinned ? false : 'start')}
          className="mr-1 shrink-0 rounded p-1 hover:bg-accent"
        >
          {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </button>
      )}
    </div>
  )
}
