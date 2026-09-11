import { useRef, useState } from 'react'
import { MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToHorizontalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { useDragBodyClass } from '@/hooks/useDragBodyClass'
import { computeColumnReorder, makeSameGroupCollisionDetection } from './DancesPage.reorder'
import type { DragEndEvent, Modifier } from '@dnd-kit/core'
import type { TableInstance } from './DancesPage.columns'

// Everything needed to let the table header's own row support drag-to-reorder,
// with pinned and unpinned columns as two separate reorderable groups that a
// drag can never cross. Returns the derived header lists (both the DndContext
// wiring and the row-rendering in TableView.tsx need these) plus a
// dndContextProps object meant to be spread directly onto <DndContext>.
export function useHeaderReorder(table: TableInstance) {
  const leafHeaders = table.getLeafHeaders()
  const pinnedHeaders = leafHeaders.filter((header) => header.column.getIsPinned() === 'start')
  const unpinnedHeaders = leafHeaders.filter((header) => header.column.getIsPinned() !== 'start')
  const pinnedIds = new Set(pinnedHeaders.map((header) => header.column.id))
  const collisionDetection = makeSameGroupCollisionDetection(pinnedIds)

  const pinBoundaryDividerRef = useRef<HTMLDivElement | null>(null)
  const [pinBoundaryX, setPinBoundaryX] = useState<number | null>(null)

  // Collision detection restricts valid drop *targets* to the dragged item's
  // own pin group, but doesn't stop the dragged item's own visual transform
  // from following the pointer past that group's boundary - this modifier
  // clamps that transform instead, using the dragged item's center (not its
  // edge) so a wide item can still overshoot enough to swap with a narrower
  // one within its own group without visually crossing the boundary at rest.
  const restrictToOwnPinGroup: Modifier = ({ transform, active, draggingNodeRect }) => {
    if (!active || !draggingNodeRect || pinBoundaryX === null) return transform

    const center = draggingNodeRect.left + draggingNodeRect.width / 2 + transform.x

    if (pinnedIds.has(active.id as string)) {
      if (center > pinBoundaryX) {
        return { ...transform, x: transform.x - (center - pinBoundaryX) }
      }
    } else if (center < pinBoundaryX) {
      return { ...transform, x: transform.x + (pinBoundaryX - center) }
    }
    return transform
  }

  const [, setIsDraggingAnyHeader] = useDragBodyClass()

  function handleDragEnd(event: DragEndEvent) {
    setIsDraggingAnyHeader(false)
    const { active, over } = event
    if (!over) return

    const result = computeColumnReorder(
      pinnedHeaders.map((header) => header.column.id),
      unpinnedHeaders.map((header) => header.column.id),
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

  return {
    leafHeaders,
    pinnedHeaders,
    unpinnedHeaders,
    pinBoundaryDividerRef,
    dndContextProps: {
      // activationConstraint:
      // plain click on header doesn't cross threshold, so dnd-kit doesn't intercept it, so the click's
      // own onClick (sort) fires normally. Only a drag past 8px (mouse) or long press (touch) starts reorder.
      sensors: useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
      ),
      collisionDetection,
      onDragStart: () => {
        setIsDraggingAnyHeader(true)
        setPinBoundaryX(pinBoundaryDividerRef.current?.getBoundingClientRect().right ?? null)
      },
      onDragCancel: () => setIsDraggingAnyHeader(false),
      onDragEnd: handleDragEnd,
      modifiers: [restrictToHorizontalAxis, restrictToParentElement, restrictToOwnPinGroup],
      autoScroll: false,
      // move DndContext's accessibility divs out of the table because react doesn't allow divs inside a table
      accessibility: { container: document.body }
    }
  }
}
