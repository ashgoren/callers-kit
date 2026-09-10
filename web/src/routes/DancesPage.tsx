import { Fragment, useState } from 'react'
import { useTable } from '@tanstack/react-table'
import type { ColumnPinningState, ColumnVisibilityState, SortingState } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, Pin, PinOff } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { columns, danceFields, features } from './DancesPage.columns'
import type { DanceWithJoins } from './DancesPage.columns'
import { useDances } from './DancesPage.data'

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

export function DancesPage() {
  const { dances, isLoading } = useDances()

  // Controlled state, so it can be read/written from outside the table.
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ start: ['title'], end: [] })

  const table = useTable({
    features,
    columns,
    data: dances,
    getRowId: (row) => row.id,
    state: { columnVisibility, sorting, columnPinning },
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    onColumnPinningChange: setColumnPinning,
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
            {table.getVisibleLeafColumns().map((column) => (
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

function ColumnsMenu({ table }: { table: ReturnType<typeof useTable<typeof features, DanceWithJoins>> }) {
  const allColumns = table.getAllLeafColumns()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-md border px-2 py-1 text-sm hover:bg-muted">
        Columns
      </DropdownMenuTrigger>
      {/* w-56 overrides the default w-(--anchor-width) */}
      <DropdownMenuContent align="end" className="w-56">
        {allColumns.map((column) => {
          // Reads the label from danceFields rather than column.columnDef.header.
          const field = danceFields.find((danceField) => danceField.key === column.id)
          const label = field?.label ?? column.id
          const isPinned = column.getIsPinned() === 'start'

          return (
            <div key={column.id} className="flex items-center">
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
                // Title: no visibility toggle (see the columns menu tests),
                // but still needs the same label position as a real item so
                // its pin toggle lines up with everyone else's.
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
        })}
      </DropdownMenuContent>
    </DropdownMenu>
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
