/* eslint-disable react-refresh/only-export-components */
import type { Ref } from 'react'

// TanStack's pinning feature only computes which columns are pinned & px offset.
// The sticky CSS that actually keeps a pinned column in place is applied here.
// start is column.getStart('start'), the pinned column's px offset from left edge,
// accounting for any pinned columns before it.
export function pinnedCellStyle(isPinned: false | 'start' | 'end', start: number) {
  if (!isPinned) return undefined
  return {
    position: 'sticky' as const,
    insetInlineStart: isPinned === 'start' ? `${start}px` : undefined,
    zIndex: 1,
  }
}

// The vertical divider between pinned and unpinned columns.
export function PinBoundaryDivider({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      data-testid="pin-boundary-divider"
      className="pointer-events-none absolute inset-y-0 right-0 w-0.5 bg-border"
    />
  )
}
