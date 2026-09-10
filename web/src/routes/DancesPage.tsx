import { Fragment, useEffect, useState } from 'react'
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTable } from '@tanstack/react-table'
import type { ColumnOrderState, ColumnPinningState, ColumnVisibilityState, SortingState } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, GripVertical, Pin, PinOff } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { columns, danceFields, features } from './DancesPage.columns'
import type { DanceWithJoins } from './DancesPage.columns'
import { useDances } from './DancesPage.data'
import { computeColumnReorder } from './DancesPage.reorder'

type TableInstance = ReturnType<typeof useTable<typeof features, DanceWithJoins>>

// TanStack's pinning feature only computes which columns are pinned & px offset.
// So we apply sticky CSS here, start is column.getStart('start'), the pinned column's
// pixel offset from the left edge, accounting for any pinned columns before it.
function pinnedCellStyle(isPinned: false | 'start' | 'end', start: number) {
  if (!isPinned) return undefined
  return {
    position: 'sticky' as const,
    insetInlineStart: isPinned === 'start' ? `${start}px` : undefined,
    zIndex: 1,
  }
}

// table.getVisibleLeafColumns() doesn't account for pinning regions, so
// it can put a pinned column anywhere its position in columnOrder happens
// to land it. But the actual rendered header/body cells do apply pinning,
// always rendering start-pinned columns first. A <colgroup>'s <col>
// elements apply to table columns purely by position, not by id, so using
// the non-pinning-aware list here would silently misassign widths to
// the wrong columns the moment a pinned column isn't already first in
// columnOrder. Concatenating all three regions in the same
// start/center/end order the real rendering uses keeps this in sync with it.
function getRenderOrderedVisibleColumns(table: TableInstance) {
  return [
    ...table.getPinnedVisibleLeafColumns('start'),
    ...table.getPinnedVisibleLeafColumns('center'),
    ...table.getPinnedVisibleLeafColumns('end'),
  ]
}

export function DancesPage() {
  const { dances, isLoading } = useDances()

  // Controlled state, so it can be read/written from outside the table.
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ start: ['title'], end: [] })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]) // defaults to order columns were defined in

  const table = useTable({
    features,
    columns,
    data: dances,
    getRowId: (row) => row.id,
    state: { columnVisibility, sorting, columnPinning, columnOrder },
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    onColumnPinningChange: setColumnPinning,
    onColumnOrderChange: setColumnOrder,
    enableMultiSort: false, // single-column sort only
    enableSortingRemoval: true, // third click clears sort
    sortDescFirst: false, // first click sorts ascending
    defaultColumn: { size: 150, minSize: 80, maxSize: 400 },
    columnResizeMode: 'onChange', // live width updates while dragging, not onEnd
  })

  if (isLoading) {
    return <p className="text-muted-foreground p-4 text-center text-sm">Loading…</p>
  }

  return (
    <div className="p-4">
      {/* Tablet and up (640px+): full table */}
      <div className="hidden sm:block">
        <div className="mb-2 flex justify-end">
          <ColumnsMenu table={table} />
        </div>
        <Table>
          {/* One <col> per visible column, carrying its resizable width -
              table-layout: fixed (table.tsx) only enforces widths declared
              this way, not inline styles on individual cells. */}
          <colgroup>
            {getRenderOrderedVisibleColumns(table).map((column) => (
              <col key={column.id} style={{ width: column.getSize() }} />
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
                      // touch-none (touch-action: none) stops the browser's own touch scroll/zoom from fighting the drag on tablet -
                      // both mousedown and touchstart are wired to the same handler, since it internally branches on which one fired.
                      // At rest, only the centered w-px child is colored, so the divider reads as a thin line rather than a thick
                      // block; on hover the full hit area highlights, making the whole grabbable zone obvious. active: (not just
                      // hover:) covers touch too - it fires on press regardless of input type, confirming the right spot was
                      // grabbed before any drag movement, which matters most on touch where there's no hover state at all.
                      // pointer-coarse: widens the hit area for touch specifically (a fingertip is far less precise than a mouse
                      // cursor) without affecting the mouse/trackpad experience, which stays at the original, narrower w-1.5.
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
              // group: lets a pinned cell's own background respond to this
              // row being hovered (see the cell's group-hover: class below) -
              // without it, the row's own hover:bg-muted/50 would visibly
              // stop at the pinned column's edge, since that column's opaque
              // background (needed so scrolled-past content doesn't show
              // through it) would otherwise paint over the row's highlight.
              <TableRow key={row.id} className="group">
                {/* getVisibleCells, not getAllCells (which includes hidden columns) */}
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    // A pinned cell needs its own opaque background so
                    // scrolled-past content doesn't show through it - and
                    // that hover tint has to stay fully opaque too
                    // (bg-muted, no /50): group-hover: replaces bg-background
                    // entirely while the row is hovered, so a translucent
                    // hover color would make the pinned column see-through
                    // to whatever had scrolled underneath it for exactly as
                    // long as that row stayed hovered - the actual bug this
                    // was built to fix. Unpinned cells don't need any of
                    // this - there's nothing underneath them to hide, so
                    // they just take the row's own hover:bg-muted/50.
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
      </div>

      {/* Phone (<640px): stacked cards */}
      <div className="sm:hidden">
        <MobileSortMenu table={table} />
        <ul className="space-y-2">
          {table.getRowModel().rows.map((row) => (
            <li key={row.id}>
              <DanceCard dance={row.original} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ColumnsMenu({ table }: { table: TableInstance }) {
  // Pinned and unpinned columns are two separate reorderable groups.
  // TanStack itself keeps them separate: a pinned column's order
  // relative to other pinned columns comes from columnPinning.start's own
  // array order, not columnOrder (which only ever affects the unpinned
  // "center" region). getPinnedLeafColumns (not getAllLeafColumns().filter(...))
  // is what actually reflects that live order - filtering getAllLeafColumns
  // preserves whatever order it already had, which doesn't change when
  // columnPinning.start's own order does, so a pinned reorder would update
  // the real table but never visibly reorder this menu's own list.
  const pinnedColumns = table.getPinnedLeafColumns('start')
  const unpinnedColumns = table.getPinnedLeafColumns('center')
  const pinnedIds = new Set(pinnedColumns.map((column) => column.id))

  // Restricts valid drop targets to whichever group (pinned/unpinned) the
  // dragged column already belongs to, so a pinned column
  // can't be dropped into the unpinned group (or vice versa).
  const sameGroupCollisionDetection: CollisionDetection = (args) => {
    const activeIsPinned = pinnedIds.has(args.active.id as string)
    const sameGroupContainers = args.droppableContainers.filter(
      (container) => pinnedIds.has(container.id as string) === activeIsPinned,
    )
    return closestCenter({ ...args, droppableContainers: sameGroupContainers })
  }

  // The grip button's own cursor-grabbing class only applies while the
  // pointer's over it, so  the cursor falls back to whatever's underneath.
  const [isDraggingAnyRow, setIsDraggingAnyRow] = useState(false)

  useEffect(() => {
    if (!isDraggingAnyRow) return
    document.body.classList.add('is-dragging-column')
    return () => {
      document.body.classList.remove('is-dragging-column')
    }
  }, [isDraggingAnyRow])

  function handleDragEnd(event: DragEndEvent) {
    setIsDraggingAnyRow(false)
    const { active, over } = event
    if (!over) return

    const result = computeColumnReorder(
      pinnedColumns.map((column) => column.id),
      unpinnedColumns.map((column) => column.id),
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
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-md border px-2 py-1 text-sm hover:bg-muted">
        Columns
      </DropdownMenuTrigger>
      {/* w-56 overrides the default w-(--anchor-width) */}
      <DropdownMenuContent align="end" className="w-56">
        {/* restrictToParentElement measures the dragged row's real DOM
            .parentElement at drag-start - each group needs its own actual
            wrapper <div> (SortableContext/DndContext don't render one) so
            that rect is scoped to just that group, preventing a pinned row
            from being dragged into the unpinned rows' space (or vice versa). */}
        <DndContext
          sensors={useSensors(useSensor(PointerSensor))}
          collisionDetection={sameGroupCollisionDetection}
          onDragStart={() => {
            setIsDraggingAnyRow(true)
          }}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setIsDraggingAnyRow(false)
          }}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          autoScroll={false}
        >
          <SortableContext items={pinnedColumns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
            <div>
              {pinnedColumns.map((column) => (
                <SortableColumnRow key={column.id} table={table} columnId={column.id} />
              ))}
            </div>
          </SortableContext>
          {pinnedColumns.length > 0 && <DropdownMenuSeparator />}
          <SortableContext items={unpinnedColumns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
            <div>
              {unpinnedColumns.map((column) => (
                <SortableColumnRow key={column.id} table={table} columnId={column.id} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Takes table + columnId, not a column object, and looks the column up fresh
// via table.getColumn(columnId), cuz passing a column object down breaks
// a second click on the same row's checkbox/pin button.
function SortableColumnRow({ table, columnId }: { table: TableInstance; columnId: string }) {
  const column = table.getColumn(columnId)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: columnId })

  if (!column) return null

  const field = danceFields.find((danceField) => danceField.key === columnId)
  const label = field?.label ?? columnId
  const isPinned = column.getIsPinned() === 'start'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center"
    >
      {/* touch-none so a touch-drag on the handle doesn't also try to scroll
          the menu - same reasoning as the column-resize handle's touch-none.
          cursor-grab/cursor-grabbing is the standard drag-handle convention -
          an open hand while just hovering, a closed one while actually
          dragging (isDragging, from useSortable). */}
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        className={`shrink-0 touch-none rounded p-1 text-muted-foreground hover:bg-accent ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      {column.getCanHide() ? (
        <DropdownMenuCheckboxItem
          className="flex-1"
          checked={column.getIsVisible()}
          onCheckedChange={(checked) => {
            column.toggleVisibility(checked)
          }}
        >
          {label}
        </DropdownMenuCheckboxItem>
      ) : (
        // Title: no visibility toggle (see the columns menu tests), but
        // still needs the same label position as a real item so its pin
        // toggle lines up with everyone else's.
        <span className="flex-1 py-1 pl-1.5 text-sm">{label}</span>
      )}
      {column.getCanPin() && (
        <button
          type="button"
          aria-label={isPinned ? `Unpin ${label}` : `Pin ${label}`}
          aria-pressed={isPinned}
          onClick={() => {
            column.pin(isPinned ? false : 'start')
          }}
          className="mr-1 shrink-0 rounded p-1 hover:bg-accent"
        >
          {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </button>
      )}
    </div>
  )
}

// Phone's substitute for clicking a table header directly - a field picker
// plus a separate direction toggle, since there's no header here to click.
// Both act through the same table.setSorting(...) the desktop header uses,
// so this is just a second way to drive the identical, single sort state.
function MobileSortMenu({ table }: { table: ReturnType<typeof useTable<typeof features, DanceWithJoins>> }) {
  const sortableColumns = table.getAllLeafColumns().filter((column) => column.getCanSort())
  const currentSort = table.state.sorting[0]
  const currentField = currentSort ? danceFields.find((field) => field.key === currentSort.id) : undefined

  return (
    <div className="mb-2 flex items-center justify-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-md border px-2 py-1 text-sm hover:bg-muted">
          {currentField ? `Sort: ${currentField.label}` : 'Sort'}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuRadioGroup
            value={currentSort?.id ?? ''}
            onValueChange={(value: string) => {
              // Always resets to ascending on a field change - matching the
              // desktop header's own first-click direction (sortDescFirst:
              // false above), not whatever direction this field was left at
              // the last time it happened to be sorted.
              table.setSorting([{ id: value, desc: false }])
            }}
          >
            {sortableColumns.map((column) => {
              const field = danceFields.find((danceField) => danceField.key === column.id)

              return (
                <DropdownMenuRadioItem key={column.id} value={column.id}>
                  {field?.label ?? column.id}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        className="rounded-md border p-1 enabled:hover:bg-muted disabled:opacity-50"
        disabled={!currentSort}
        onClick={() => {
          if (!currentSort) return
          table.setSorting([{ id: currentSort.id, desc: !currentSort.desc }])
        }}
        aria-label={currentSort?.desc ? 'Sort descending' : 'Sort ascending'}
      >
        {currentSort?.desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
      </button>
    </div>
  )
}

// Derives its fields from the same danceFields array the table columns use.
// We override the title field display and filter it out of the generic loop.
function DanceCard({ dance }: { dance: DanceWithJoins }) {
  const titleField = danceFields.find((field) => field.key === 'title')!

  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">{titleField.render(dance.title)}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {danceFields
          .filter((field) => field.key !== 'title')
          .map((field) => (
            <Fragment key={field.key}>
              <dt className="text-muted-foreground">{field.label}</dt>
              {/* min-w-0 so the value can shrink to fit the card's width, so truncate works */}
              <dd className="min-w-0">{(field.cardRender ?? field.render)(dance[field.key])}</dd>
            </Fragment>
          ))}
      </dl>
    </div>
  )
}
