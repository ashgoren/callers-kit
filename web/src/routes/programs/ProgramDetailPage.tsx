import { useParams } from 'react-router'
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
      {!program ? (
        <p className="text-sm text-muted-foreground">Program not found.</p>
      ) : (
        <>
          <div className="border-b pb-4">
            <h1 className="text-4xl font-semibold">{program.date ? formatDate(program.date) : 'No date'}</h1>
            {program.location && <p className="mt-1 text-base text-muted-foreground">{program.location}</p>}
          </div>

          <FieldList fields={programDetailFields} row={program} className="mt-6 space-y-6" />
        </>
      )}
    </div>
  )
}
