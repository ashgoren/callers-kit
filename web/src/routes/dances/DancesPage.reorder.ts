import { closestCenter } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { CollisionDetection } from '@dnd-kit/core'
import type { TableInstance } from './DancesPage.columns'

// Column reordering is wired up on two separate drag surfaces - the table
// header row's own columns, and the manage-columns menu's rows - and both
// share the three functions below: collision detection during the drag,
// deciding what a completed drag does, and applying that decision to table
// state. Only one of the two groups (pinned/unpinned) is ever affected by a
// given drag, so a pinned column can only be reordered among other pinned
// columns, and likewise for unpinned columns.

// Runs continuously during a drag (not just at drop) to keep a dragged
// column from ever being reported "over" a container in the other group -
// restricting valid drop targets to whichever group the dragged item
// belongs to, so a drag can never cross that boundary mid-gesture.
// computeColumnReorder below still decides what a completed drag actually
// does; this only shapes what dnd-kit reports as `over`.
export function makeSameGroupCollisionDetection(pinnedIds: Set<string>): CollisionDetection {
  return (args) => {
    const activeIsPinned = pinnedIds.has(args.active.id as string)
    const sameGroupContainers = args.droppableContainers.filter(
      (container) => pinnedIds.has(container.id as string) === activeIsPinned,
    )
    return closestCenter({ ...args, droppableContainers: sameGroupContainers })
  }
}

// Pure decision logic for a completed drag: given the current pinned/
// unpinned id lists and which item was dropped where, returns the new order -
// or null when there's nothing to do (dropped back onto itself, dragged
// across the pinned/unpinned boundary, or an id from neither list). Takes
// plain id arrays rather than a TableInstance so testable in isolation.
export function computeColumnReorder(
  pinnedIds: string[],
  unpinnedIds: string[],
  activeId: string,
  overId: string,
): { pinnedIds: string[] } | { unpinnedIds: string[] } | null {
  if (activeId === overId) return null

  if (pinnedIds.includes(activeId) && pinnedIds.includes(overId)) {
    return { pinnedIds: arrayMove(pinnedIds, pinnedIds.indexOf(activeId), pinnedIds.indexOf(overId)) }
  }
  if (unpinnedIds.includes(activeId) && unpinnedIds.includes(overId)) {
    return { unpinnedIds: arrayMove(unpinnedIds, unpinnedIds.indexOf(activeId), unpinnedIds.indexOf(overId)) }
  }
  return null
}

// Runs computeColumnReorder on a completed drag and writes the result to
// table state - the function each drag surface's onDragEnd actually calls,
// so neither has to re-implement the same pinnedIds/unpinnedIds if/else.
export function applyColumnReorder(
  table: TableInstance,
  pinnedIds: string[],
  unpinnedIds: string[],
  activeId: string,
  overId: string,
): void {
  const result = computeColumnReorder(pinnedIds, unpinnedIds, activeId, overId)
  if (!result) return

  if ('pinnedIds' in result) {
    table.setColumnPinning((old) => ({ ...old, start: result.pinnedIds }))
  } else {
    table.setColumnOrder(result.unpinnedIds)
  }
}
