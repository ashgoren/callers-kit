import { useEffect, useState } from 'react'
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pin } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
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
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="rounded-md border px-2 py-1 text-sm hover:bg-muted">
        Columns
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
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

  return (
    // column.getIsVisible()/getIsPinned() hide their real dependency behind
    // `column`, an object TanStack keeps stable across renders - the render
    // this row would otherwise get from its `table` prop changing isn't
    // enough for React Compiler to see that those specific method results
    // changed, so it can cache stale JSX for them (TanStack's own
    // react-compiler guide documents this exact hazard: "hiding a state read
    // behind a builder method"). table.Subscribe's callback runs fresh on
    // every relevant state change, sidestepping that entirely.
    <table.Subscribe selector={(state) => ({ columnVisibility: state.columnVisibility, columnPinning: state.columnPinning })}>
      {() => {
        const isPinned = column.getIsPinned() === 'start'
        const isOnlyVisibleColumn = column.getIsVisible() && table.getVisibleLeafColumns().length === 1

        return (
          <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className="flex items-center gap-0.5"
          >
            <button
              type="button"
              aria-label={`Reorder ${label}`}
              className={`shrink-0 touch-none rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>
            {column.getCanPin() && (
              <button
                type="button"
                aria-label={isPinned ? `Unpin ${label}` : `Pin ${label}`}
                aria-pressed={isPinned}
                onClick={() => column.pin(isPinned ? false : 'start')}
                className="shrink-0 rounded p-1.5 hover:bg-accent hover:text-accent-foreground"
              >
                <Pin className={`size-4 transition-transform ${isPinned ? '' : 'rotate-90'}`} />
              </button>
            )}
            <span id={`${columnId}-label`} className="flex-1 truncate py-1.5 pl-2 text-sm">
              {label}
            </span>
            {column.getCanHide() && (
              <Switch
                size="lg"
                className="mr-2"
                aria-labelledby={`${columnId}-label`}
                checked={column.getIsVisible()}
                disabled={isOnlyVisibleColumn}
                onCheckedChange={(checked) => column.toggleVisibility(checked)}
              />
            )}
          </div>
        )
      }}
    </table.Subscribe>
  )
}
