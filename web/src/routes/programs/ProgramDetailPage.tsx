import { useParams } from 'react-router'
import { z } from 'zod'
import { EditableDate } from '@/components/fields/EditableDate'
import { EditableLocationCombobox } from '@/components/fields/EditableLocationCombobox'
import { EditableRichText } from '@/components/fields/EditableRichText'
import { PageSpinner } from '@/components/PageSpinner'
import { FieldList } from '@/components/fields/FieldList'
import { makeDetailFieldDefiner } from '@/components/fields/DetailField'
import { commitFieldEdit } from '@/lib/powersync/commitFieldEdit'
import { ProgramDanceLineup } from './ProgramDanceLineup'
import { useProgram } from './ProgramDetailPage.data'
import type { DetailField } from '@/components/fields/DetailField'
import type { ProgramWithJoins } from './ProgramsPage.columns'

const dateSchema = z
  .string()
  .min(1, 'Date is required')
  .nullable()
  .refine((value) => value !== null, { message: 'Date is required' })

const defineField = makeDetailFieldDefiner<ProgramWithJoins>()

const programDetailFields: DetailField<ProgramWithJoins>[] = [
  defineField({
    key: 'notes',
    label: 'Notes',
    render: (value, row) => (
      <EditableRichText
        value={value}
        onCommit={(v) => void commitFieldEdit('programs', row.id, 'notes', v)}
        triggerLabel="Edit notes"
      />
    ),
  }),
]

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
            <EditableLocationCombobox
              value={program.location_id}
              onCommit={(v) => void commitFieldEdit('programs', program.id, 'location_id', v)}
              as="p"
              // pl-3.25: lines up with the date field's text + its padding + its invisible border.
              className="mt-1 pl-3.25 text-base text-muted-foreground"
            />
          </div>

          <div className="mt-6 space-y-8">
            <ProgramDanceLineup programId={program.id} dances={program.dances} />
            <FieldList fields={programDetailFields} row={program} />
          </div>
        </>
      )}
    </div>
  )
}
