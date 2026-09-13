import { PageSpinner } from '@/components/PageSpinner'
import { CardList } from '@/components/table/CardList'
import { ColumnSizingSync } from '@/components/table/ColumnSizingSync'
import { TableView } from '@/components/table/TableView'
import { useDataTable } from '@/components/table/useDataTable'
import { useDances } from './DancesPage.data'
import { columns, DEFAULT_COLUMN_STATE } from './DancesPage.columns'
import { DanceCard } from './DancesPage.DanceCard'

export function DancesPage() {
  const { dances, isLoading: dancesLoading } = useDances()
  const { table, isLoading: preferencesLoading, resetColumns, columnSizing, setColumnSizing } = useDataTable({
    tableName: 'dances',
    columns,
    data: dances,
    defaultColumnState: DEFAULT_COLUMN_STATE,
  })

  if (dancesLoading || preferencesLoading) return <PageSpinner />

  return (
    <div className="p-4">
      <ColumnSizingSync table={table} savedColumnSizing={columnSizing} setColumnSizing={setColumnSizing} />

      {/* Tablet and up (640px+): full table */}
      <div className="hidden sm:block">
        <TableView table={table} resetColumns={resetColumns} />
      </div>

      {/* Phone (<640px): stacked cards */}
      <div className="sm:hidden">
        <CardList table={table} renderCard={(dance) => <DanceCard dance={dance} />} />
      </div>
    </div>
  )
}
