import { ArrowDown, ArrowUp } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ColumnsMenu } from './DancesPage.ColumnsMenu'
import type { TableInstance } from './DancesPage.columns'

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

export function TableView({ table }: { table: TableInstance }) {
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
          {table.getLeafHeaders().map((header) => (
            <col key={header.column.id} style={{ width: header.column.getSize() }} />
          ))}
        </colgroup>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={header.column.getIsPinned() ? 'relative bg-background' : 'relative'}
                  style={pinnedCellStyle(header.column.getIsPinned(), header.column.getStart('start'))}
                >
                  {/* The whole header is the sort toggle, not a separate icon */}
                  {header.isPlaceholder ? null : (
                    <button
                      type="button"
                      className="flex w-full items-center gap-1 text-left enabled:cursor-pointer disabled:cursor-default"
                      onClick={header.column.getToggleSortingHandler()}
                      disabled={!header.column.getCanSort()}
                    >
                      <table.FlexRender header={header} />
                      {header.column.getIsSorted() === 'asc' && <ArrowUp className="size-3.5" />}
                      {header.column.getIsSorted() === 'desc' && <ArrowDown className="size-3.5" />}
                    </button>
                  )}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-primary/50 active:bg-primary/50 pointer-coarse:w-4"
                    >
                      <div className="mx-auto h-full w-px bg-border" />
                    </div>
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
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
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
