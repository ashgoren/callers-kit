import { arrayMove } from '@dnd-kit/sortable'

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
