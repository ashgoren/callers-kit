import { formatFormation } from './DancesPage.columns'
import { makeDetailFieldDefiner } from '@/components/fields/DetailField'
import { formatDate, mutedPlaceholder, sortAlphabetically } from '@/lib/format'
import { formatProgramLabel } from '@/routes/programs/ProgramsPage.columns'
import type { ReactNode } from 'react'
import type { DetailField } from '@/components/fields/DetailField'
import type { DanceWithJoins } from './DancesPage.columns'

function renderChipList(values: string[]): ReactNode {
  if (values.length === 0) return mutedPlaceholder
  return (
    <div className="flex flex-wrap gap-1">
      {sortAlphabetically(values).map((value) => (
        <span key={value} className="rounded-full border bg-muted px-2 py-0.5 text-xs">
          {value}
        </span>
      ))}
    </div>
  )
}

function renderProgramHistory(value: DanceWithJoins['programs']): ReactNode {
  if (value.length === 0) return mutedPlaceholder
  return (
    <ul className="space-y-0.5">
      {value.map((program) => (
        <li key={program.id}>{formatProgramLabel(program)}</li>
      ))}
    </ul>
  )
}

const defineField = makeDetailFieldDefiner<DanceWithJoins>()

// The wide column's fields - just notes for now.
export const danceWideFields: DetailField<DanceWithJoins>[] = [
  defineField({
    key: 'notes',
    label: 'Notes',
    // whitespace-pre-wrap: notes include literal newlines
    render: (value) => (value ? <p className="whitespace-pre-wrap">{value}</p> : mutedPlaceholder),
  }),
]

// The narrow column's fields.
export const danceMetadataFields: DetailField<DanceWithJoins>[] = [
  defineField({ key: 'key_moves', label: 'Key Moves', render: renderChipList }),
  defineField({ key: 'vibes', label: 'Vibes', render: renderChipList }),
  defineField({ key: 'difficulty', label: 'Difficulty', render: (value) => (value === null ? mutedPlaceholder : value) }),
  defineField({ key: 'dance_type', label: 'Dance Type', render: (value) => (value === null ? mutedPlaceholder : value) }),
  defineField({
    key: 'formation',
    label: 'Formation',
    render: (value) => (value === null ? mutedPlaceholder : formatFormation(value)),
  }),
  defineField({ key: 'progression', label: 'Progression', render: (value) => (value === null ? mutedPlaceholder : value) }),
  defineField({ key: 'programs', label: 'Programs', render: renderProgramHistory }),
  defineField({ key: 'created_at', label: 'Created', render: (value) => (value === null ? mutedPlaceholder : formatDate(value)) }),
  defineField({ key: 'updated_at', label: 'Updated', render: (value) => (value === null ? mutedPlaceholder : formatDate(value)) }),
]
