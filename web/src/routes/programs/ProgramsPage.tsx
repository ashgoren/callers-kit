import { useNavigate } from 'react-router'
import { PageSpinner } from '@/components/PageSpinner'
import { CardList } from '@/components/table/CardList'
import { ColumnSizingSync } from '@/components/table/ColumnSizingSync'
import { TableView } from '@/components/table/TableView'
import { useDataTable } from '@/components/table/useDataTable'
import { usePrograms } from './ProgramsPage.data'
import { columns, DEFAULT_COLUMN_STATE } from './ProgramsPage.columns'
import { ProgramCard } from './ProgramsPage.ProgramCard'
import type { ProgramWithJoins } from './ProgramsPage.columns'

export function ProgramsPage() {
  const navigate = useNavigate()
  const { programs, isLoading: programsLoading } = usePrograms()
  const { table, isLoading: preferencesLoading, resetColumns, columnSizing, setColumnSizing } = useDataTable({
    tableName: 'programs',
    columns,
    data: programs,
    defaultColumnState: DEFAULT_COLUMN_STATE,
  })

  if (programsLoading || preferencesLoading) return <PageSpinner />

  const openProgram = (program: ProgramWithJoins) => void navigate(`/programs/${program.id}`)

  return (
    <div className="p-4">
      <ColumnSizingSync table={table} savedColumnSizing={columnSizing} setColumnSizing={setColumnSizing} />

      {/* Tablet and up (640px+): full table */}
      <div className="hidden sm:block">
        <TableView table={table} resetColumns={resetColumns} onRowClick={openProgram} />
      </div>

      {/* Phone (<640px): stacked cards */}
      <div className="sm:hidden">
        <CardList
          table={table}
          renderCard={(program) => (
            <button type="button" className="block w-full text-left" onClick={() => openProgram(program)}>
              <ProgramCard program={program} />
            </button>
          )}
        />
      </div>
    </div>
  )
}
