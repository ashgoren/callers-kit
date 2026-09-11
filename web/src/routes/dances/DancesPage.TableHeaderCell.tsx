import { ArrowDown, ArrowUp } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from 'cn'
import { TableHead } from '@/components/ui/table'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { useCoarsePointer } from '@/hooks/useCoarsePointer'
import { ColumnResizeHandle } from './DancesPage.ColumnResizeHandle'
import { pinnedCellStyle, PinBoundaryDivider } from './DancesPage.pinning'
import type { Ref } from 'react'
import type { LeafHeader, TableInstance } from './DancesPage.columns'

// Mouse (non-touch) devices only: The header's right-click menu.
function ContextMenuPopup({ table, header, isPinned }: {
  table: TableInstance
  header: LeafHeader
  isPinned: false | 'start' | 'end'
}) {
  return (
    <ContextMenuContent>
      {header.column.getCanHide() && (
        <ContextMenuItem
          disabled={header.column.getIsVisible() && table.getVisibleLeafColumns().length === 1}
          onClick={() => header.column.toggleVisibility(false)}
        >
          Hide
        </ContextMenuItem>
      )}
      {header.column.getCanPin() && (
        <ContextMenuItem onClick={() => header.column.pin(isPinned === 'start' ? false : 'start')}>
          {isPinned === 'start' ? 'Unpin' : 'Pin'}
        </ContextMenuItem>
      )}
    </ContextMenuContent>
  )
}

// table.Subscribe fixes React Compiler caching stale results for getIsPinned/getIsVisible/getIsSorted
export function TableHeaderCell({ table, header, pinBoundaryDividerRef }: {
  table: TableInstance
  header: LeafHeader
  pinBoundaryDividerRef: Ref<HTMLDivElement | null>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: header.column.id })
  const isCoarsePointer = useCoarsePointer()

  return (
    <table.Subscribe selector={(state) => ({ columnVisibility: state.columnVisibility, columnPinning: state.columnPinning, sorting: state.sorting })}>
      {() => {
        const isPinned = header.column.getIsPinned()
        const isSorted = header.column.getIsSorted()

        const sortButton = header.isPlaceholder ? null : (
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-1 text-left enabled:cursor-pointer disabled:cursor-default',
              // touch-none only on mouse/pointer devices allows mouse drag claim the gesture immediately.
              // On a touch it's deliberately omitted so a quick swipe still scrolls natively.
              !isCoarsePointer && 'touch-none',
              isDragging && 'cursor-grabbing',
            )}
            onClick={header.column.getToggleSortingHandler()}
            disabled={!header.column.getCanSort()}
            {...attributes}
            {...listeners}
          >
            <table.FlexRender header={header} />
            {isSorted === 'asc' && <ArrowUp className="size-3.5" />}
            {isSorted === 'desc' && <ArrowDown className="size-3.5" />}
          </button>
        )

        const cellContent = (
          <>
            {sortButton}
            {header.column.getCanResize() && <ColumnResizeHandle table={table} header={header} />}
          </>
        )

        return (
          <TableHead
            ref={setNodeRef}
            className={cn('relative', isDragging ? 'bg-accent' : isPinned && 'bg-background')}
            style={{
              ...pinnedCellStyle(isPinned, header.column.getStart('start')),
              transform: CSS.Translate.toString(transform),
              transition: [transition, 'background-color 150ms ease'].filter(Boolean).join(', '),
              ...(isDragging && { zIndex: 10 }),
            }}
          >
            {isCoarsePointer ? (
              // Touch: suppress the platform's own long-press menu because it would race dnd-kit's own long-press.
              <div className="contents select-none" style={{ WebkitTouchCallout: 'none' }} onContextMenu={(event) => event.preventDefault()}>
                {cellContent}
              </div>
            ) : (
              // Mouse: attach a right-click menu to table header cell.
              <ContextMenu>
                <ContextMenuTrigger className="contents">
                  {cellContent}
                </ContextMenuTrigger>
                <ContextMenuPopup table={table} header={header} isPinned={isPinned} />
              </ContextMenu>
            )}
            {header.column.getIsLastColumn('start') && <PinBoundaryDivider ref={pinBoundaryDividerRef} />}
          </TableHead>
        )
      }}
    </table.Subscribe>
  )
}
