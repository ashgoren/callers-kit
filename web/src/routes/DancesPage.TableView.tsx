import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToHorizontalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { useCoarsePointer } from '@/hooks/useCoarsePointer'
import { useDragBodyClass } from '@/hooks/useDragBodyClass'
import { ColumnResizeHandle } from './DancesPage.ColumnResizeHandle'
import { ColumnsMenu } from './DancesPage.ColumnsMenu'
import { computeColumnReorder, makeSameGroupCollisionDetection } from './DancesPage.reorder'
import type { ReactNode, Ref } from 'react'
import type { DragEndEvent, Modifier } from '@dnd-kit/core'
import type { LeafHeader, TableInstance } from './DancesPage.columns'

// TanStack's pinning feature only computes which columns are pinned & px offset.
// The sticky CSS that actually keeps a pinned column in place is applied here.
// start is column.getStart('start'), the pinned column's px offset from left edge,
// accounting for any pinned columns before it.
function pinnedCellStyle(isPinned: false | 'start' | 'end', start: number) {
  if (!isPinned) return undefined
  return {
    position: 'sticky' as const,
    insetInlineStart: isPinned === 'start' ? `${start}px` : undefined,
    zIndex: 1,
  }
}

function PinBoundaryDivider({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return <div ref={ref} data-testid="pin-boundary-divider" className="pointer-events-none absolute inset-y-0 right-0 w-0.5 bg-border" />
}

function HeaderContextMenuItems({ table, header, isPinned }: {
  table: TableInstance
  header: LeafHeader
  isPinned: false | 'start' | 'end'
}) {
  return (
    <>
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
    </>
  )
}

// Hosts the header's right-click menu around whatever's passed as children (sort button & resize handle).
// On coarse pointer it's skipped entirely rather than raced against dnd-kit's own long-press.
function HeaderContextMenuWrapper({ table, header, isPinned, children }: {
  table: TableInstance
  header: LeafHeader
  isPinned: false | 'start' | 'end'
  children: ReactNode
}) {
  const isCoarsePointer = useCoarsePointer()

  if (isCoarsePointer) {
    return (
      <div className="contents select-none" style={{ WebkitTouchCallout: 'none' }} onContextMenu={(event) => event.preventDefault()}>
        {children}
      </div>
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className="contents">{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <HeaderContextMenuItems table={table} header={header} isPinned={isPinned} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function TableView({ table }: { table: TableInstance }) {
  // Pinned and unpinned columns are two separate reorderable groups here.
  const leafHeaders = table.getLeafHeaders()
  const pinnedHeaders = leafHeaders.filter((header) => header.column.getIsPinned() === 'start')
  const unpinnedHeaders = leafHeaders.filter((header) => header.column.getIsPinned() !== 'start')
  const pinnedIds = new Set(pinnedHeaders.map((header) => header.column.id))
  const sameGroupCollisionDetection = makeSameGroupCollisionDetection(pinnedIds)

  const pinBoundaryDividerRef = useRef<HTMLDivElement | null>(null)
  const [pinBoundaryX, setPinBoundaryX] = useState<number | null>(null)

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

  return (
    <>
      <div className="mb-2 flex justify-end">
        <ColumnsMenu table={table} />
      </div>
      <Table>
        {/* One <col> per visible column, carrying its resizable width -
            table-layout: fixed (table.tsx) only enforces widths declared
            this way, not inline styles on individual cells. getLeafHeaders
            (not getVisibleLeafColumns, which ignores pinning order) builds
            its list off the same start/center/end-ordered getHeaderGroups()
            the header row below renders from, so a <colgroup>'s <col>
            elements - which apply to table columns purely by position, not
            by id - always land on the column the header row actually put
            in that position. */}
        <colgroup>
          {leafHeaders.map((header) => (
            <col key={header.column.id} style={{ width: header.column.getSize() }} />
          ))}
        </colgroup>
        {/* activationConstraint: plain click on sort button doesn't cross threshold, so dnd-kit
            doesn't intercept it, and the click's own onClick (sort) fires normally.
            Only a real drag past 8px starts a reorder. */}
        <DndContext
          sensors={useSensors(
            useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
            useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
          )}
          collisionDetection={sameGroupCollisionDetection}
          onDragStart={() => {
            setIsDraggingAnyHeader(true)
            setPinBoundaryX(pinBoundaryDividerRef.current?.getBoundingClientRect().right ?? null)
          }}
          onDragCancel={() => setIsDraggingAnyHeader(false)}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToHorizontalAxis, restrictToParentElement, restrictToOwnPinGroup]}
          autoScroll={false}
          accessibility={{ container: document.body }}
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                <SortableContext items={pinnedHeaders.map((header) => header.column.id)} strategy={horizontalListSortingStrategy}>
                  {pinnedHeaders.map((header) => (
                    <SortableTableHead key={header.id} table={table} header={header} pinBoundaryDividerRef={pinBoundaryDividerRef} />
                  ))}
                </SortableContext>
                <SortableContext items={unpinnedHeaders.map((header) => header.column.id)} strategy={horizontalListSortingStrategy}>
                  {unpinnedHeaders.map((header) => (
                    <SortableTableHead key={header.id} table={table} header={header} pinBoundaryDividerRef={pinBoundaryDividerRef} />
                  ))}
                </SortableContext>
              </TableRow>
            ))}
          </TableHeader>
        </DndContext>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            // group: allows pinned cell's bg to respond to this row being hovered (see cell's group-hover class below).
            <TableRow key={row.id} className="group">
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  // Pinned cells need their own opaque background so scrolled-past content doesn't bleed through.
                  // That hover tint must be fully opaque (bg-muted), not semi-transparent (bg-muted/50).
                  // group-hover: replaces bg-background entirely while the row is hovered.
                  // Unpinned cells don't need this, so they just take the row's own hover:bg-muted/50.
                  className={cell.column.getIsPinned() ? 'bg-background group-hover:bg-muted' : undefined}
                  style={pinnedCellStyle(cell.column.getIsPinned(), cell.column.getStart('start'))}
                >
                  <table.FlexRender cell={cell} />
                  {cell.column.getIsLastColumn('start') && <PinBoundaryDivider />}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}

// table.Subscribe fixes React Compiler caching stale results for getIsPinned/getIsVisible/getIsSorted
function SortableTableHead({
  table,
  header,
  pinBoundaryDividerRef,
}: {
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
            // touch-none only on mouse/pointer devices allows mouse drag claim the gesture immediately
            // On a touch it's deliberately omitted so a quick swipe still scrolls natively.
            className={`flex w-full items-center gap-1 text-left enabled:cursor-pointer disabled:cursor-default ${isCoarsePointer ? '' : 'touch-none'} ${isDragging ? 'cursor-grabbing' : ''}`}
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

        return (
          <TableHead
            ref={setNodeRef}
            className={`relative ${isDragging ? 'bg-accent' : isPinned ? 'bg-background' : ''}`}
            style={{
              ...pinnedCellStyle(isPinned, header.column.getStart('start')),
              transform: CSS.Translate.toString(transform),
              transition: [transition, 'background-color 150ms ease'].filter(Boolean).join(', '),
              ...(isDragging && { zIndex: 10 }),
            }}
          >
            <HeaderContextMenuWrapper table={table} header={header} isPinned={isPinned}>
              {sortButton}
              {header.column.getCanResize() && <ColumnResizeHandle table={table} header={header} />}
            </HeaderContextMenuWrapper>
            {header.column.getIsLastColumn('start') && <PinBoundaryDivider ref={pinBoundaryDividerRef} />}
          </TableHead>
        )
      }}
    </table.Subscribe>
  )
}
