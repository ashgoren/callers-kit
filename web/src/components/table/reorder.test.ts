import { describe, expect, it, vi } from 'vitest'
import { applyColumnReorder, computeColumnReorder, makeSameGroupCollisionDetection } from './reorder'
import type { CollisionDetection } from '@dnd-kit/core'
import type { TableInstance } from './tableInstance'

interface Row {
  id: string
}

describe('computeColumnReorder', () => {
  // This is the decision logic dnd-kit's onDragEnd hands off to: given the
  // current pinned/unpinned id lists and which column was dragged onto
  // which, decide whether - and how - to reorder. It's tested directly,
  // independent of any actual drag gesture, for the same jsdom-layout
  // reason called out in reorder.ts: dnd-kit's own collision detection can't
  // be meaningfully simulated here, but this pure function has no such
  // dependency, so it can be checked thoroughly on its own.
  const pinnedIds = ['a', 'b']
  const unpinnedIds = ['c', 'd', 'e']

  it('reorders within the pinned group when both ids are pinned', () => {
    expect(computeColumnReorder(pinnedIds, unpinnedIds, 'b', 'a')).toEqual({
      pinnedIds: ['b', 'a'],
    })
  })

  it('reorders within the unpinned group when both ids are unpinned', () => {
    expect(computeColumnReorder(pinnedIds, unpinnedIds, 'e', 'c')).toEqual({
      unpinnedIds: ['e', 'c', 'd'],
    })
  })

  it('is a no-op when dragging a column onto itself', () => {
    expect(computeColumnReorder(pinnedIds, unpinnedIds, 'a', 'a')).toBeNull()
    expect(computeColumnReorder(pinnedIds, unpinnedIds, 'd', 'd')).toBeNull()
  })

  it('is a no-op when the active column is pinned and the target is unpinned', () => {
    expect(computeColumnReorder(pinnedIds, unpinnedIds, 'a', 'd')).toBeNull()
  })

  it('is a no-op when the active column is unpinned and the target is pinned', () => {
    expect(computeColumnReorder(pinnedIds, unpinnedIds, 'd', 'a')).toBeNull()
  })

  it('is a no-op when either id belongs to neither group', () => {
    expect(computeColumnReorder(pinnedIds, unpinnedIds, 'unknown', 'a')).toBeNull()
    expect(computeColumnReorder(pinnedIds, unpinnedIds, 'a', 'unknown')).toBeNull()
    expect(computeColumnReorder(pinnedIds, unpinnedIds, 'unknown', 'also-unknown')).toBeNull()
  })
})

describe('applyColumnReorder', () => {
  // Only the two methods this function actually calls are faked - the rest
  // of TableInstance's huge interface is irrelevant to what's being tested.
  function makeFakeTable() {
    return { setColumnPinning: vi.fn(), setColumnOrder: vi.fn() } as unknown as TableInstance<Row> & {
      setColumnPinning: ReturnType<typeof vi.fn>
      setColumnOrder: ReturnType<typeof vi.fn>
    }
  }

  it('merges the new pinned order into existing pinning state via setColumnPinning, preserving other pinning state', () => {
    const table = makeFakeTable()

    applyColumnReorder(table, ['a', 'b'], ['c', 'd'], 'b', 'a')

    expect(table.setColumnOrder).not.toHaveBeenCalled()
    const updater = table.setColumnPinning.mock.calls[0][0] as (old: { start: string[]; end: string[] }) => unknown
    expect(updater({ start: ['a', 'b'], end: ['z'] })).toEqual({ start: ['b', 'a'], end: ['z'] })
  })

  it('replaces the order outright via setColumnOrder for an unpinned reorder', () => {
    const table = makeFakeTable()

    applyColumnReorder(table, ['a', 'b'], ['c', 'd'], 'd', 'c')

    expect(table.setColumnPinning).not.toHaveBeenCalled()
    expect(table.setColumnOrder).toHaveBeenCalledWith(['d', 'c'])
  })

  it('writes nothing to table state when computeColumnReorder is a no-op', () => {
    const table = makeFakeTable()

    applyColumnReorder(table, ['a', 'b'], ['c', 'd'], 'a', 'a')

    expect(table.setColumnPinning).not.toHaveBeenCalled()
    expect(table.setColumnOrder).not.toHaveBeenCalled()
  })
})

describe('makeSameGroupCollisionDetection', () => {
  // Plain numeric rects, not real DOM elements - closestCenter (the
  // algorithm this wraps) only ever reads the rect/id data passed in here,
  // never real getBoundingClientRect values, so this exercises the actual
  // production collision-detection function directly, unlike the real-drag
  // e2e tests this same group restriction is also proven through.
  function makeArgs(activeId: string, rectsByContainerId: Record<string, number>): Parameters<CollisionDetection>[0] {
    return {
      active: { id: activeId },
      collisionRect: { left: 0, top: 0, width: 10, height: 10, bottom: 10, right: 10 },
      droppableRects: new Map(
        Object.entries(rectsByContainerId).map(([id, left]) => [
          id,
          { left, top: 0, width: 10, height: 10, bottom: 10, right: left + 10 },
        ]),
      ),
      droppableContainers: Object.keys(rectsByContainerId).map((id) => ({ id })),
      pointerCoordinates: null,
    } as unknown as Parameters<CollisionDetection>[0]
  }

  it('only considers containers in the dragged item\'s own group, even when a container in the other group is physically closer', () => {
    const detection = makeSameGroupCollisionDetection(new Set(['a', 'b']))

    // 'x' (not in the pinned set, so "unpinned") sits right next to the drag
    // origin; 'b' (in the pinned set, same group as active 'a') sits much
    // further away. Plain closestCenter would put 'x' first - this should
    // exclude it entirely since 'a' is pinned and 'x' isn't.
    const result = detection(makeArgs('a', { x: 5, b: 100 }))

    expect(result.map((collision) => collision.id)).toEqual(['b'])
  })

  it('returns no collisions when nothing in the dragged item\'s group is present', () => {
    const detection = makeSameGroupCollisionDetection(new Set(['a']))

    const result = detection(makeArgs('a', { x: 5, y: 10 }))

    expect(result).toEqual([])
  })
})
