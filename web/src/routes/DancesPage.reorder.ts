import { closestCenter } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { CollisionDetection } from '@dnd-kit/core'

// Pure decision logic for a completed column-menu drag.
// Only one of the two groups is ever affected by a given drag - a pinned
// column can only be reordered among other pinned columns, and likewise for
// unpinned columns, so callers should already be restricting which columns
// can be dragged over which via their own collision detection.
// Returns null when nothing to do: dropped back onto itself, dragged across the
// pinned/unpinned boundary, or an id from neither list.
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

// Shared by both places a pinned/unpinned column list can be dragged to
// reorder (the manage-columns menu's rows, and the table header's own
// columns) - restricts valid drop targets to whichever group (pinned or
// unpinned) the dragged item belongs to, so a drag can never cross that
// boundary mid-gesture. computeColumnReorder above still has the final say
// on what a completed drag actually does; this only shapes collision
// detection during the drag itself.
export function makeSameGroupCollisionDetection(pinnedIds: Set<string>): CollisionDetection {
  return (args) => {
    const activeIsPinned = pinnedIds.has(args.active.id as string)
    const sameGroupContainers = args.droppableContainers.filter(
      (container) => pinnedIds.has(container.id as string) === activeIsPinned,
    )
    return closestCenter({ ...args, droppableContainers: sameGroupContainers })
  }
}
