import { useEffect, useRef } from 'react'
import type { ColumnSizingState, Updater } from '@tanstack/react-table'
import type { TableInstance } from './DancesPage.columns'

// Bridges the table's own uncontrolled columnSizing (see DancesPage.tsx for
// why it's deliberately left out of the table's controlled state) with the
// synced value from useTableColumnState. Two independent directions, kept
// separate on purpose:
//
// - Inbound: apply the synced width map whenever it changes - on first load,
//   or because another device committed a resize while this tab was idle.
//
// - Outbound: persist the table's own widths, but only once a resize drag
//   actually finishes (state.columnResizing.isResizingColumn flips from the
//   dragged column's id back to false), not on every pixel of movement -
//   committing on every onChange frame would mean dozens of local db writes
//   over a single drag, the same class of problem that caused the Safari
//   initial-sync slowdown documented in the rebuild plan.
export function ColumnSizingSync({ table, savedColumnSizing, setColumnSizing }: {
  table: TableInstance
  savedColumnSizing: ColumnSizingState
  setColumnSizing: (updater: Updater<ColumnSizingState>) => void
}) {
  // Inbound: apply the synced value from db whenever it changes, unless a column is currently being resized.
  useEffect(() => {
    // Unless a column is currently being resized, apply the synced value from db
    // if it differs from the table's own value.
    if (table.state.columnResizing.isResizingColumn !== false) return
    if (JSON.stringify(table.state.columnSizing) !== JSON.stringify(savedColumnSizing)) {
      table.setColumnSizing(savedColumnSizing)
    }
  }, [savedColumnSizing, table])

  return (
    <table.Subscribe selector={(state) => ({ isResizingColumn: state.columnResizing.isResizingColumn })}>
      {({ isResizingColumn }) => (
        <CommitOnResizeEnd table={table} isResizingColumn={isResizingColumn} setColumnSizing={setColumnSizing} />
      )}
    </table.Subscribe>
  )
}

// Outbound: persist the table's own widths once a resize drag actually finishes.
function CommitOnResizeEnd({ table, isResizingColumn, setColumnSizing }: {
  table: TableInstance
  isResizingColumn: false | string
  setColumnSizing: (updater: Updater<ColumnSizingState>) => void
}) {
  const wasResizing = useRef(false)

  useEffect(() => {
    if (wasResizing.current && !isResizingColumn) setColumnSizing(table.state.columnSizing)
    wasResizing.current = isResizingColumn !== false
  }, [isResizingColumn, setColumnSizing, table])

  return null
}
