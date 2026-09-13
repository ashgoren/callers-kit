import {
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import type { RowData } from '@tanstack/react-table'

// Shared TanStack Table feature registration for both Dances & Programs tables.
export const dataTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnSizingFeature,
  columnResizingFeature,
  columnPinningFeature,
  columnOrderingFeature,
})

export type TableInstance<TRow extends RowData> = ReturnType<typeof useTable<typeof dataTableFeatures, TRow>>
export type LeafHeader<TRow extends RowData> = ReturnType<TableInstance<TRow>['getLeafHeaders']>[number]
