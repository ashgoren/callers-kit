import { ArrowDown, ArrowUp } from 'lucide-react'
import { DndContext } from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { useCoarsePointer } from '@/hooks/useCoarsePointer'
import { ColumnResizeHandle } from './DancesPage.ColumnResizeHandle'
import { ColumnsMenu } from './DancesPage.ColumnsMenu'
import { pinnedCellStyle, PinBoundaryDivider } from './DancesPage.pinning'
import { useHeaderReorder } from './DancesPage.useHeaderReorder'
import type { ReactNode, Ref } from 'react'
import type { LeafHeader, TableInstance } from './DancesPage.columns'

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
  const { leafHeaders, pinnedHeaders, unpinnedHeaders, pinBoundaryDividerRef, dndContextProps } = useHeaderReorder(table)

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
            in that position.

            Wrapped in table.Subscribe (selecting columnSizing) for the same
            React Compiler staleness reason documented on SortableTableHead's
            own table.Subscribe below - header.column.getSize() hides its real
            dependency behind the stable header object, so without this the
            compiler can memoize this <col> away and never re-read a live
            resize's updated width. */}
        <table.Subscribe selector={(state) => ({ columnSizing: state.columnSizing })}>
          {() => (
            <colgroup>
              {leafHeaders.map((header) => (
                <col key={header.column.id} style={{ width: header.column.getSize() }} />
              ))}
            </colgroup>
          )}
        </table.Subscribe>
        <DndContext {...dndContextProps}>
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
