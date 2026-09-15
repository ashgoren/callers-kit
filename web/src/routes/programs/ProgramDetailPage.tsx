import { useParams } from 'react-router'
import { z } from 'zod'
import { EditableDate } from '@/components/fields/EditableDate'
import { PageSpinner } from '@/components/PageSpinner'
import { FieldList } from '@/components/fields/FieldList'
import { commitFieldEdit } from '@/lib/powersync/commitFieldEdit'
import { useProgram } from './ProgramDetailPage.data'
import { programDetailFields } from './ProgramDetailPage.fields'

const dateSchema = z
  .string()
  .min(1, 'Date is required')
  .nullable()
  .refine((value) => value !== null, { message: 'Date is required' })

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
            <EditableDate
              value={program.date}
              onCommit={(value) => void commitFieldEdit('programs', program.id, 'date', value)}
              schema={dateSchema}
              as="h1"
              className="font-semibold text-4xl md:text-4xl"
              // Extra md:text-4xl needed for edit mode since Input has default text-sm className.
            />
            {program.location && (
              // pl-3.25: lines up with the date field's text + its padding + its invisible border.
              <p className="mt-1 pl-3.25 text-base text-muted-foreground">{program.location}</p>
            )}
          </div>

          <FieldList fields={programDetailFields} row={program} className="mt-6 space-y-6" />
        </>
      )}
    </div>
  )
}
