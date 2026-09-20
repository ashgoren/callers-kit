import { useNavigate } from 'react-router'
import { PageSpinner } from '@/components/PageSpinner'
import { CardList } from '@/components/table/CardList'
import { ColumnSizingSync } from '@/components/table/ColumnSizingSync'
import { TableView } from '@/components/table/TableView'
import { useDataTable } from '@/components/table/useDataTable'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useDances } from './DancesPage.data'
import { columns, DEFAULT_COLUMN_STATE } from './DancesPage.columns'
import { DanceCard } from './DancesPage.DanceCard'
import type { DanceWithJoins } from './dance'

export function DancesPage() {
  useDocumentTitle('Dances')
  const navigate = useNavigate()
  const { dances, isLoading: dancesLoading } = useDances()
  const { table, isLoading: preferencesLoading, resetColumns, columnSizing, setColumnSizing } = useDataTable({
    tableName: 'dances',
    columns,
    data: dances,
    defaultColumnState: DEFAULT_COLUMN_STATE,
  })

  if (dancesLoading || preferencesLoading) return <PageSpinner />

  const openDance = (dance: DanceWithJoins) => void navigate(`/dances/${dance.id}`)

  return (
    <div className="p-4">
      <ColumnSizingSync table={table} savedColumnSizing={columnSizing} setColumnSizing={setColumnSizing} />

      {/* Tablet and up (640px+): full table */}
      <div className="hidden sm:block">
        <TableView table={table} resetColumns={resetColumns} onRowClick={openDance} />
      </div>

      {/* Phone (<640px): stacked cards */}
      <div className="sm:hidden">
        <CardList
          table={table}
          renderCard={(dance) => (
            <button type="button" className="block w-full text-left" onClick={() => openDance(dance)}>
              <DanceCard dance={dance} />
            </button>
          )}
        />
      </div>
    </div>
  )
}
