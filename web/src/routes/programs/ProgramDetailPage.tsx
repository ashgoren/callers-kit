import { Link, useParams } from 'react-router'
import { PageSpinner } from '@/components/PageSpinner'
import { FieldList } from '@/components/fields/FieldList'
import { formatDate } from '@/lib/format'
import { useProgram } from './ProgramDetailPage.data'
import { programDetailFields } from './ProgramDetailPage.fields'

export function ProgramDetailPage() {
  const { id } = useParams()
  const { program, isLoading } = useProgram(id ?? '')

  if (isLoading) return <PageSpinner />

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Link to="/programs" className="text-sm text-muted-foreground hover:text-foreground">
        ← Programs
      </Link>

      {!program ? (
        <p className="mt-4 text-sm text-muted-foreground">Program not found.</p>
      ) : (
        <>
          <div className="mt-2 border-b pb-4">
            <h1 className="text-2xl font-semibold">{program.date ? formatDate(program.date) : 'No date'}</h1>
            {program.location && <p className="mt-0.5 text-sm text-muted-foreground">{program.location}</p>}
          </div>

          <FieldList fields={programDetailFields} row={program} className="mt-6 space-y-4" />
        </>
      )}
    </div>
  )
}
