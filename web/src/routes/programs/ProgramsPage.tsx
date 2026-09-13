import { PageSpinner } from '@/components/PageSpinner'
import { CardList } from '@/components/table/CardList'
import { ColumnSizingSync } from '@/components/table/ColumnSizingSync'
import { TableView } from '@/components/table/TableView'
import { useDataTable } from '@/components/table/useDataTable'
import { usePrograms } from './ProgramsPage.data'
import { columns, DEFAULT_COLUMN_STATE } from './ProgramsPage.columns'
import { ProgramCard } from './ProgramsPage.ProgramCard'

export function ProgramsPage() {
  const { programs, isLoading: programsLoading } = usePrograms()
  const { table, isLoading: preferencesLoading, resetColumns, columnSizing, setColumnSizing } = useDataTable({
    tableName: 'programs',
    columns,
    data: programs,
    defaultColumnState: DEFAULT_COLUMN_STATE,
  })

  if (programsLoading || preferencesLoading) return <PageSpinner />

  return (
    <div className="p-4">
      <ColumnSizingSync table={table} savedColumnSizing={columnSizing} setColumnSizing={setColumnSizing} />

      {/* Tablet and up (640px+): full table */}
      <div className="hidden sm:block">
        <TableView table={table} resetColumns={resetColumns} />
      </div>

      {/* Phone (<640px): stacked cards */}
      <div className="sm:hidden">
        <CardList table={table} renderCard={(program) => <ProgramCard program={program} />} />
      </div>
    </div>
  )
}
