import { DndContext } from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { cn } from 'cn'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { ColumnsMenu } from './ColumnsMenu'
import { pinnedCellStyle, PinBoundaryDivider } from './pinning'
import { TableHeaderCell } from './TableHeaderCell'
import { useHeaderReorder } from './useHeaderReorder'
import type { MouseEvent } from 'react'
import type { RowData } from '@tanstack/react-table'
import type { TableInstance } from './tableInstance'

export function TableView<TRow extends RowData>({
  table,
  resetColumns,
  onRowClick,
}: {
  table: TableInstance<TRow>
  resetColumns: () => void
  onRowClick?: (row: TRow) => void
}) {
  const { leafHeaders, pinnedHeaders, unpinnedHeaders, pinBoundaryDividerRef, dndContextProps } = useHeaderReorder(table)

  return (
    <>
      <div className="mb-2 flex justify-end">
        <ColumnsMenu table={table} onReset={resetColumns} />
      </div>
      <Table>
        {/* Wrapped in table.Subscribe (selecting columnSizing) to address React Compiler staleness issue. */}
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
                    <TableHeaderCell key={header.id} table={table} header={header} pinBoundaryDividerRef={pinBoundaryDividerRef} />
                  ))}
                </SortableContext>
                <SortableContext items={unpinnedHeaders.map((header) => header.column.id)} strategy={horizontalListSortingStrategy}>
                  {unpinnedHeaders.map((header) => (
                    <TableHeaderCell key={header.id} table={table} header={header} pinBoundaryDividerRef={pinBoundaryDividerRef} />
                  ))}
                </SortableContext>
              </TableRow>
            ))}
          </TableHeader>
        </DndContext>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            // group: allows pinned cell's bg to respond to this row being hovered (see cell's group-hover class below).
            <TableRow
              key={row.id}
              className={cn('group', onRowClick && 'cursor-pointer')}
              onClick={
                onRowClick &&
                ((event: MouseEvent<HTMLTableRowElement>) => {
                  // Don't trigger row click if the user clicked a link in the row.
                  if ((event.target as HTMLElement).closest('a')) return
                  onRowClick(row.original)
                })
              }
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  // Pinned cells need their own opaque background so scrolled-past content doesn't bleed through.
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
